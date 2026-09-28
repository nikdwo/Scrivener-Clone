using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Schreibatelier.App;
using Schreibatelier.Core;

internal static class ProofRegressionChecks
{
    internal static async Task Run(string directory, Action<bool, string> check)
    {
        var work = Path.Combine(directory, "regressions-" + Model.Id()); Directory.CreateDirectory(work);
        foreach (var failure in new[] { "eof", "invalid", "shape", "turn" })
        {
            var starts = 0; var paths = new List<string>();
            using var codex = new CodexProofreader(Path.Combine(work, failure), () =>
            {
                var path = Path.Combine(work, failure + "-" + ++starts); paths.Add(path);
                var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
                if (string.Equals(Path.GetFileNameWithoutExtension(Environment.ProcessPath), "dotnet", StringComparison.OrdinalIgnoreCase)) start.ArgumentList.Add(typeof(ProofRegressionChecks).Assembly.Location);
                foreach (var argument in new[] { "--fake-codex", starts == 1 ? failure : "healthy", path }) start.ArgumentList.Add(argument);
                return start;
            });
            var elapsed = Stopwatch.StartNew();
            var error = await Fails<IOException>(failure == "turn" ? codex.Check([new(0, "Synthetic manuscript sentence.")], "de-DE", "synthetic-model", false, CancellationToken.None) : codex.Status());
            check(error.InnerException is not null, "Codex " + failure + " retains the reader failure cause");
            check(elapsed.Elapsed < TimeSpan.FromSeconds(10), "Codex " + failure + " fails pending request without the 60-second timeout");
            check(starts == 1, "Codex " + failure + " never retries an interrupted action automatically");
            var oldOwner = typeof(CodexProofreader).GetField("connection", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(codex);
            var status = JsonSerializer.SerializeToNode(await codex.Status().WaitAsync(TimeSpan.FromSeconds(10)), Model.Json)!;
            check(starts == 2 && status["connected"]!.GetValue<bool>(), "Codex " + failure + " restarts on the next user action");
            var oldPid = int.Parse(await File.ReadAllTextAsync(paths[0] + ".pid"));
            check(Exited(oldPid), "Codex " + failure + " terminates the owner process after reader failure");
            // Resume a request carrying the old owner after restart, as a late async continuation would.
            var oldRequest = (Task)typeof(CodexProofreader).GetMethod("Request", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(codex, [oldOwner, "stale-owner-request", null])!;
            await Fails<IOException>(oldRequest);
            check(!(await File.ReadAllLinesAsync(paths[1] + ".log")).Contains("stale-owner-request"), "Late Codex request cannot write to a replacement process after " + failure);
            await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => codex.Status())).WaitAsync(TimeSpan.FromSeconds(10));
            check(starts == 2, "Parallel Codex status requests reuse one healthy connection after " + failure);
            check((await File.ReadAllLinesAsync(paths[1] + ".log")).Count(m => m == "initialize") == 1, "Codex restart initializes exactly once after " + failure);
        }

        var secret = Path.Combine(work, "languagetool.dat");
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var reply = new TaskCompletionSource<HttpResponseMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        using (var service = new ProofreadingService(work, null, new HttpClient(new FakeHttp(async () => { entered.TrySetResult(); return await reply.Task; }))))
        {
            var connect = service.ConnectPremium("test@example.invalid", "synthetic-key");
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var disconnect = service.DisconnectPremium();
            check(!disconnect.IsCompleted, "Premium disconnect waits for the in-flight connection");
            reply.SetResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"software\":{\"premium\":true}}") });
            await Task.WhenAll(connect, disconnect).WaitAsync(TimeSpan.FromSeconds(10));
            check(!File.Exists(secret), "Premium credentials cannot reappear after disconnect completes");
            check(JsonSerializer.SerializeToNode(service.Status(), Model.Json)!["premiumConnected"]!.GetValue<bool>() == false, "Premium status reports disconnected only after credentials are removed");
        }

        entered = new(TaskCreationOptions.RunContinuationsAsynchronously); reply = new(TaskCreationOptions.RunContinuationsAsynchronously);
        await File.WriteAllTextAsync(secret, "synthetic-existing-credentials");
        using (var service = new ProofreadingService(work, null, new HttpClient(new FakeHttp(async () => { entered.TrySetResult(); return await reply.Task; }))))
        {
            var connect = service.ConnectPremium("test@example.invalid", "synthetic-key");
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var disconnect = service.DisconnectPremium();
            reply.SetResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
            await Fails<HttpRequestException>(connect); await disconnect.WaitAsync(TimeSpan.FromSeconds(5));
            check(!File.Exists(secret), "Premium disconnect also completes after a failed connection");
            await File.WriteAllTextAsync(secret, "synthetic-existing-credentials");
            using (var locked = new FileStream(secret, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                await Fails<IOException>(service.DisconnectPremium());
                check(File.Exists(secret), "Premium deletion failure preserves the connected state and reports the error");
            }
            await service.DisconnectPremium();
            check(!File.Exists(secret), "Premium gate is released after a credential deletion failure");
        }
    }

    private static async Task<T> Fails<T>(Task task) where T : Exception
    {
        try { await task.WaitAsync(TimeSpan.FromSeconds(10)); }
        catch (T error) { return error; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    private static bool Exited(int pid)
    {
        try { using var process = Process.GetProcessById(pid); return process.HasExited; }
        catch (ArgumentException) { return true; }
    }
    private sealed class FakeHttp(Func<Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) => respond();
    }

    internal static async Task RunServer(string mode, string path)
    {
        await File.WriteAllTextAsync(path + ".pid", Environment.ProcessId.ToString());
        while (await Console.In.ReadLineAsync() is { } line)
        {
            var request = JsonNode.Parse(line)!.AsObject(); var method = request["method"]!.GetValue<string>();
            await File.AppendAllTextAsync(path + ".log", method + "\n");
            if (request["id"] is not { } id) continue;
            if (method == "account/read" && mode is "eof" or "invalid" or "shape")
            {
                if (mode == "shape") { await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new { id = id.GetValue<int>(), result = Array.Empty<string>() })); await Console.Out.FlushAsync(); }
                else if (mode == "invalid") { await Console.Out.WriteLineAsync("invalid-json"); await Console.Out.FlushAsync(); }
                else { await Console.Out.FlushAsync(); CloseHandle(GetStdHandle(-11)); }
                await Task.Delay(Timeout.Infinite); // Remain alive: the client's failed reader must stop this process.
            }
            object result = method switch
            {
                "account/read" => new { account = new { type = "chatgpt", email = "synthetic@example.invalid", planType = "test" } },
                "model/list" => new { data = new[] { new { model = "synthetic-model", displayName = "Synthetic" } } },
                "thread/start" => new { activePermissionProfile = new { id = "schreibatelier-proofreading" }, thread = new { id = "synthetic-thread" } },
                _ => new { }
            };
            await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new { id = id.GetValue<int>(), result }, Model.Json));
            await Console.Out.FlushAsync();
            if (method == "turn/start" && mode == "turn")
            {
                await Console.Out.WriteLineAsync("invalid-json"); await Console.Out.FlushAsync();
                await Task.Delay(Timeout.Infinite);
            }
        }
    }

    [DllImport("kernel32.dll")] private static extern IntPtr GetStdHandle(int handle);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(IntPtr handle);
}
