using System.ComponentModel;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace Schreibatelier.Core;

[SupportedOSPlatform("windows10.0")]
internal sealed class WindowsConverterProcess : IDisposable
{
    private SafeFileHandle? job;
    private AnonymousPipeServerStream? input, output, error;
    private Process? process;
    private StreamReader? stdout, stderr;

    internal Process Process => process!;
    internal Stream StandardInput => input!;
    internal StreamReader StandardOutput => stdout!;
    internal StreamReader StandardError => stderr!;

    internal static WindowsConverterProcess Start(string executable, IEnumerable<string> arguments, string workingDirectory)
    {
        var commandLine = new StringBuilder();
        foreach (var argument in new[] { Path.GetFullPath(executable) }.Concat(arguments)) AppendArgument(commandLine, argument);
        var owner = new WindowsConverterProcess();
        nint attributes = 0, jobs = 0, handles = 0;
        var attributesInitialized = false;
        SafeProcessHandle? nativeProcess = null;
        SafeFileHandle? nativeThread = null;
        try
        {
            owner.job = CreateJobObjectW(0, null);
            if (owner.job.IsInvalid) throw new Win32Exception(Marshal.GetLastPInvokeError());
            var limits = new ExtendedLimits { BasicLimitInformation = new BasicLimits { LimitFlags = 0x2000 } }; // KILL_ON_JOB_CLOSE; no breakaway.
            if (!SetInformationJobObject(owner.job, 9, ref limits, Marshal.SizeOf<ExtendedLimits>())) throw new Win32Exception(Marshal.GetLastPInvokeError());
            owner.input = new(PipeDirection.Out, HandleInheritability.Inheritable);
            owner.output = new(PipeDirection.In, HandleInheritability.Inheritable);
            owner.error = new(PipeDirection.In, HandleInheritability.Inheritable);
            owner.stdout = new(owner.output, Encoding.UTF8, true, 4096);
            owner.stderr = new(owner.error, Encoding.UTF8, true, 4096);

            nuint size = 0;
            InitializeProcThreadAttributeList(0, 2, 0, ref size);
            attributes = Marshal.AllocHGlobal(checked((nint)size));
            if (!InitializeProcThreadAttributeList(attributes, 2, 0, ref size)) throw new Win32Exception(Marshal.GetLastPInvokeError());
            attributesInitialized = true;
            jobs = Marshal.AllocHGlobal(nint.Size);
            Marshal.WriteIntPtr(jobs, owner.job.DangerousGetHandle());
            handles = Marshal.AllocHGlobal(3 * nint.Size);
            nint[] childHandles = [owner.input.ClientSafePipeHandle.DangerousGetHandle(), owner.output.ClientSafePipeHandle.DangerousGetHandle(), owner.error.ClientSafePipeHandle.DangerousGetHandle()];
            for (var index = 0; index < childHandles.Length; index++) Marshal.WriteIntPtr(handles, index * nint.Size, childHandles[index]);
            // Job assignment is part of creation, before the child can run or spawn descendants.
            // https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
            if (!UpdateProcThreadAttribute(attributes, 0, 0x2000D, jobs, (nuint)nint.Size, 0, 0)
                || !UpdateProcThreadAttribute(attributes, 0, 0x20002, handles, (nuint)(3 * nint.Size), 0, 0)) throw new Win32Exception(Marshal.GetLastPInvokeError());
            var startup = new StartupInfoEx
            {
                StartupInfo = new StartupInfo { Size = Marshal.SizeOf<StartupInfoEx>(), Flags = 0x100, StandardInput = childHandles[0], StandardOutput = childHandles[1], StandardError = childHandles[2] },
                Attributes = attributes
            };
            const uint creationFlags = 0x08000000 | 0x00080000 | 0x00000004; // NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT | SUSPENDED.
            if (!CreateProcessW(Path.GetFullPath(executable), commandLine, 0, 0, true, creationFlags, 0, workingDirectory, ref startup, out var created)) throw new Win32Exception(Marshal.GetLastPInvokeError());
            nativeProcess = new(created.Process, true);
            nativeThread = new(created.Thread, true);
            // Retain a .NET process handle before a fast child can exit; the job already owns it.
            owner.process = Process.GetProcessById(checked((int)created.ProcessId));
            _ = owner.process.SafeHandle;
            owner.input.DisposeLocalCopyOfClientHandle();
            owner.output.DisposeLocalCopyOfClientHandle();
            owner.error.DisposeLocalCopyOfClientHandle();
            if (ResumeThread(nativeThread) == uint.MaxValue) throw new Win32Exception(Marshal.GetLastPInvokeError());
            return owner;
        }
        catch
        {
            owner.Dispose(); // Closing the non-inherited job also kills a suspended child after a setup failure.
            throw;
        }
        finally
        {
            nativeThread?.Dispose(); nativeProcess?.Dispose();
            if (attributesInitialized) DeleteProcThreadAttributeList(attributes);
            Marshal.FreeHGlobal(attributes); Marshal.FreeHGlobal(jobs); Marshal.FreeHGlobal(handles);
        }
    }

    internal async Task Terminate()
    {
        if (!TerminateJobObject(job!, 1)) throw new Win32Exception(Marshal.GetLastPInvokeError());
        var watch = Stopwatch.StartNew();
        while (true)
        {
            if (!QueryInformationJobObject(job!, 1, out var accounting, Marshal.SizeOf<BasicAccounting>(), 0)) throw new Win32Exception(Marshal.GetLastPInvokeError());
            if (accounting.ActiveProcesses == 0) return;
            if (watch.Elapsed > TimeSpan.FromSeconds(5)) throw new TimeoutException("Die Konverterprozesse wurden nicht rechtzeitig beendet.");
            await Task.Delay(10);
        }
    }

    public void Dispose()
    {
        job?.Dispose();
        input?.Dispose(); stdout?.Dispose(); stderr?.Dispose();
        output?.Dispose(); error?.Dispose(); process?.Dispose();
    }

    private static void AppendArgument(StringBuilder commandLine, string argument)
    {
        ArgumentNullException.ThrowIfNull(argument);
        if (argument.Contains('\0')) throw new ArgumentException("Ein Konverterargument enthält ein Nullzeichen.", nameof(argument));
        if (commandLine.Length > 0) commandLine.Append(' ');
        commandLine.Append('"');
        var backslashes = 0;
        foreach (var character in argument)
        {
            if (character == '\\') { backslashes++; continue; }
            commandLine.Append('\\', character == '"' ? backslashes * 2 + 1 : backslashes);
            commandLine.Append(character); backslashes = 0;
        }
        commandLine.Append('\\', backslashes * 2).Append('"');
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public int Size;
        public nint Reserved, Desktop, Title;
        public uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags;
        public ushort ShowWindow, ReservedSize;
        public nint ReservedBytes, StandardInput, StandardOutput, StandardError;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx { public StartupInfo StartupInfo; public nint Attributes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation { public nint Process, Thread; public uint ProcessId, ThreadId; }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public nuint MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public nuint Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public nuint ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicAccounting
    {
        public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern SafeFileHandle CreateJobObjectW(nint securityAttributes, string? name);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(SafeFileHandle job, int informationClass, ref ExtendedLimits information, int length);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool InitializeProcThreadAttributeList(nint attributes, int count, uint flags, ref nuint size);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UpdateProcThreadAttribute(nint attributes, uint flags, nuint attribute, nint value, nuint size, nint previous, nint returnedSize);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(nint attributes);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessW(string application, StringBuilder commandLine, nint processAttributes, nint threadAttributes, [MarshalAs(UnmanagedType.Bool)] bool inheritHandles, uint flags, nint environment, string currentDirectory, ref StartupInfoEx startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(SafeFileHandle thread);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateJobObject(SafeFileHandle job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryInformationJobObject(SafeFileHandle job, int informationClass, out BasicAccounting information, int length, nint returnedLength);
}
