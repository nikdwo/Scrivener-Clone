using System.Windows;

namespace Schreibatelier.App;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) => { MessageBox.Show(args.Exception.Message, "Schreibatelier – Fehler", MessageBoxButton.OK, MessageBoxImage.Error); args.Handled = true; };
        new MainWindow(e.Args).Show();
    }
}
