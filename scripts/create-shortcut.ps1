# create-shortcut.ps1 - create a desktop shortcut for DeepSeek Harness Desktop
# and write System.AppUserModel.ID into the .lnk so the Windows taskbar and
# pinned entries show the app icon (must match app.setAppUserModelId in
# electron/main.js).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1 [-Name "Shortcut Name"] [-AppId "com.deepseek.dsh-desktop"]
#
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads it as the system codepage).
param(
    [string]$Name = "DeepSeek Harness Desktop.lnk",
    [string]$AppId = "com.deepseek.dsh-desktop"
)
$ErrorActionPreference = "Stop"

$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ElectronExe = Join-Path $ProjectDir "node_modules\electron\dist\electron.exe"
$Icon = Join-Path $ProjectDir "assets\dsh-desktop.ico"

if (-not (Test-Path $ElectronExe)) {
    Write-Error "electron.exe not found - run npm install first ($ElectronExe)"
    exit 1
}
if (-not (Test-Path $Icon)) {
    Write-Error "icon not found - run npm run make:icon first ($Icon)"
    exit 1
}

$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not $Name.EndsWith(".lnk")) { $Name = $Name + ".lnk" }
$ShortcutPath = Join-Path $Desktop $Name

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ElectronExe
$Shortcut.Arguments = "`"$ProjectDir`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.IconLocation = "$Icon,0"
$Shortcut.Description = "DeepSeek Harness Desktop - double-click to run"
$Shortcut.Save()

# --- Set System.AppUserModel.ID via IShellLink -> IPropertyStore -------------
# (WScript.Shell cannot set this property; it must live in the .lnk's
#  PropertyStoreDataBlock. IShellLink + IPropertyStore::Commit writes it there;
#  Explorer reads it for the taskbar / pinned icon.)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ShortcutAppId
{
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    public class ShellLink { }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-c000-000000000046")]
    public interface IPersistFile
    {
        [PreserveSig] int GetClassID(out Guid pClassID);
        [PreserveSig] int IsDirty();
        [PreserveSig] int Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
        [PreserveSig] int Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
        [PreserveSig] int SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
        [PreserveSig] int GetCurFile(out IntPtr ppszFileName);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    public interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint cProps);
        [PreserveSig] int GetAt(uint iProp, out PROPERTYKEY pkey);
        [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        [PreserveSig] int Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPVARIANT
    {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public IntPtr p;
    }

    private static readonly Guid APPID_FMTID = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
    private const uint APPID_PID = 5; // PKEY_AppUserModel_ID
    private const ushort VT_LPWSTR = 31;
    private const int STGM_READWRITE = 2;

    public static void Set(string lnkPath, string appId)
    {
        IPersistFile pf = (IPersistFile)(new ShellLink());
        try
        {
            int hr = pf.Load(lnkPath, STGM_READWRITE);
            if (hr != 0) throw new COMException("IPersistFile.Load failed: 0x" + hr.ToString("X8"));
            IPropertyStore store = (IPropertyStore)pf;
            PROPERTYKEY key = new PROPERTYKEY();
            key.fmtid = APPID_FMTID;
            key.pid = APPID_PID;
            PROPVARIANT pv = new PROPVARIANT();
            pv.vt = VT_LPWSTR;
            pv.p = Marshal.StringToCoTaskMemUni(appId);
            try
            {
                hr = store.SetValue(ref key, ref pv);
                // S_OK (0) or S_FALSE (1, value already equal / no change) are both fine
                if (hr != 0 && hr != 1) throw new COMException("SetValue failed: 0x" + hr.ToString("X8"));
                hr = store.Commit();
                if (hr != 0) throw new COMException("Commit failed: 0x" + hr.ToString("X8"));
            }
            finally
            {
                Marshal.FreeCoTaskMem(pv.p);
            }
            hr = pf.Save(lnkPath, true); // flush the PropertyStoreDataBlock to disk
            if (hr != 0) throw new COMException("IPersistFile.Save failed: 0x" + hr.ToString("X8"));
        }
        finally
        {
            Marshal.FinalReleaseComObject(pf);
        }
    }
}
"@

[ShortcutAppId]::Set($ShortcutPath, $AppId)

# Verify through the shell property system (the same path Windows uses)
$ShellApp = New-Object -ComObject Shell.Application
$Folder = $ShellApp.Namespace((Split-Path $ShortcutPath))
$Item = $Folder.ParseName((Split-Path $ShortcutPath -Leaf))
$ReadBack = $Item.ExtendedProperty("System.AppUserModel.ID")
if ($ReadBack -ne $AppId) {
    Write-Error "AppUserModelID write-back mismatch: got '$ReadBack'"
    exit 1
}

Write-Host "Desktop shortcut created: $ShortcutPath"
Write-Host "  Target: $ElectronExe"
Write-Host "  Args: `"$ProjectDir`""
Write-Host "  Icon: $Icon"
Write-Host "  AppUserModelID: $ReadBack (verified via shell property system)"
