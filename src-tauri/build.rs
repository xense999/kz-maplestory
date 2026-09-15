/// release 版的 Windows manifest。與 tauri-build 的預設版本差別只有一處：
/// `requestedExecutionLevel` 從 asInvoker 改成 requireAdministrator。
///
/// debug 版刻意不套（見下面的判斷）——開發時每次啟動都要點一次 UAC，
/// 而 `tauri dev` 的自動重啟會被那個對話框卡住。要驗管理員行為就用
/// 管理員身分的終端機跑 dev。
const ADMIN_MANIFEST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{e2011457-1546-43c5-a5fe-008deee3d3f0}" />
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}" />
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}" />
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}" />
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>"#;

fn main() {
    // 金鑰是 build 時編進去的（見 maple.rs 的 api_key）。cargo 預設不知道這個變數，
    // 換了 secret 卻沿用舊的編譯快取就會發出舊金鑰。
    println!("cargo:rerun-if-env-changed=MAPLE_API_KEY");

    let mut attrs = tauri_build::Attributes::new();

    if std::env::var("PROFILE").as_deref() == Ok("release") {
        attrs = attrs.windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(ADMIN_MANIFEST),
        );
    }

    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
