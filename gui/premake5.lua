local qt_libs     = { "Qt6Widgets", "Qt6WebChannel", "Qt6WebEngineWidgets", "Qt6Gui", "Qt6Core", "Qt6WebEngineCore" }
local saucer_dir = os.getenv("SAUCER_DIR") or "vendor/saucer"

workspace("predoc-gui")
configurations({ "redist" })
architecture("x86_64")

project("predoc-gui")
kind("ConsoleApp")
language("C++")
cppdialect("C++23")
targetdir("bin")
files({ "src/**.cpp" })

filter("system:linux")
	includedirs({ "vendor" })
	includedirs({ saucer_dir .. "/include" })
	libdirs({ saucer_dir .. "/lib" })

filter("system:windows")
	includedirs({ "vendor" })
	includedirs({ saucer_dir .. "/include" })
	libdirs({ saucer_dir .. "/lib" })

filter({ "system:windows", "configurations:redist" })
	kind("WindowedApp")
	links({ "saucer", "coco", "WebView2LoaderStatic" })
	links({ "Wininet", "gdiplus", "Shlwapi", "Comctl32", "CoreMessaging", "RuntimeObject", "Bcrypt" })
	linkoptions({ "/ENTRY:mainCRTStartup" })

filter({ "system:linux", "configurations:redist" })
	buildoptions({ "-mno-direct-extern-access" })
	links({ "saucer", "coco" })
	links(qt_libs)
	linkoptions({ "-Wl,-rpath,/usr/lib/x86_64-linux-gnu" })