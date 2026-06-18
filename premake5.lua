-- premake5 install  -> install predoc to system
-- premake5 uninstall -> remove installed artifacts

local function is_windows()
	return os.getenv("OS") == "Windows_NT"
end

local function mkdir_p(path)
	if is_windows() then
		os.execute('cmd /c if not exist "' .. path .. '" mkdir "' .. path .. '"')
	else
		os.execute("mkdir -p " .. path)
	end
end

local function cp(src, dst)
	if is_windows() then
		os.execute('cmd /c copy /y "' .. src .. '" "' .. dst .. '"')
	else
		os.execute("cp " .. src .. " " .. dst)
	end
end

local function cp_r(src, dst)
	if is_windows() then
		os.execute('cmd /c xcopy /E /I /Y "' .. src .. '" "' .. dst .. '"')
	else
		os.execute("cp -r " .. src .. "/. " .. dst .. "/")
	end
end

local function rm_r(path)
	if is_windows() then
		os.execute('cmd /c rmdir /S /Q "' .. path .. '" 2>nul')
	else
		os.execute("rm -rf " .. path)
	end
end

local function file_exists(path)
	local f = io.open(path, "r")
	if f then
		f:close()
		return true
	end
	return false
end

local function dir_exists(path)
	if is_windows() then
		local f = io.open(path, "r")
		if f then
			f:close()
			return true
		end
		return false
	end
	local r = os.execute("test -d " .. path)
	return r == 0
end

local function write_manifest(path, entries)
	local dir = path:match("^(.*/)")
	if dir then
		mkdir_p(dir)
	end
	local f = io.open(path, "w")
	if f then
		for _, e in ipairs(entries) do
			f:write(e .. "\n")
		end
		f:close()
	end
end

local function read_manifest(path)
	local entries = {}
	local f = io.open(path, "r")
	if f then
		for line in f:lines() do
			table.insert(entries, line)
		end
		f:close()
	end
	return entries
end

local function symlink(target, link)
	if is_windows() then
		return
	end
	os.execute("ln -sf " .. target .. " " .. link)
end

local function default_prefix()
	if is_windows() then
		local pf = os.getenv("PROGRAMFILES")
		if pf then
			return pf .. "/predoc"
		end
		return "C:/Program Files/predoc"
	end
	return "/opt/predoc"
end

newaction({
	trigger = "install",
	description = "Install predoc to system",
	execute = function()
		local prefix = os.getenv("PREFIX") or default_prefix()
		local bindir = prefix .. "/bin"
		local assetdir = prefix .. "/editor/public"
		local contentdir = prefix .. "/content"
		local hugodir = prefix .. "/hugo"
		local symlink_path = "/usr/local/bin/predoc-gui"

		-- Check required artifacts exist
		local required = {
			"gui/bin/predoc-gui",
			"editor/public",
			"hugo-view/themes",
			"hugo-view/hugo.toml",
		}
		local missing = {}
		for _, r in ipairs(required) do
			if not file_exists(r) and not dir_exists(r) then
				table.insert(missing, r)
			end
		end
		if #missing > 0 then
			print("  error: missing artifacts:")
			for _, m in ipairs(missing) do
				print("    " .. m)
			end
			print("  Build first with: make")
			return
		end

		mkdir_p(bindir)
		mkdir_p(assetdir)
		mkdir_p(contentdir)
		mkdir_p(hugodir .. "/themes")

		local installed = {}

		-- Copy binary
		local bin_dst = bindir .. "/predoc-gui"
		cp("gui/bin/predoc-gui", bin_dst)
		table.insert(installed, bin_dst)

		-- Copy editor assets
		cp_r("editor/public", assetdir)
		table.insert(installed, assetdir)

		-- Copy content
		cp_r("content", contentdir)
		table.insert(installed, contentdir)

		-- Copy hugo themes and config
		cp_r("hugo-view/themes", hugodir .. "/themes")
		cp("hugo-view/hugo.toml", hugodir .. "/hugo.toml")
		table.insert(installed, hugodir .. "/themes")
		table.insert(installed, hugodir .. "/hugo.toml")

		-- Symlink in PATH
		if not is_windows() then
			mkdir_p("/usr/local/bin")
			symlink(bin_dst, symlink_path)
			table.insert(installed, symlink_path)
		end

		-- Write manifest alongside installed files
		local manifest_file = prefix .. "/.install_manifest"
		write_manifest(manifest_file, installed)
		table.insert(installed, manifest_file)

		print("  -> Installed to " .. prefix)
	end,
})

newaction({
	trigger = "uninstall",
	description = "Remove installed predoc",
	execute = function()
		-- TODO: we need a 'clean' step or an option during unninstall to remove the .cache folders as well
		local prefix = os.getenv("PREFIX") or default_prefix()
		local manifest_file = prefix .. "/.install_manifest"
		local entries = read_manifest(manifest_file)

		if #entries == 0 then
			entries = {
				prefix .. "/bin/predoc-gui",
				prefix .. "/editor/public",
				prefix .. "/content",
				prefix .. "/hugo",
				prefix .. "/.install_manifest",
				"/usr/local/bin/predoc-gui",
			}
		end

		for _, e in ipairs(entries) do
			if dir_exists(e) then
				rm_r(e)
			elseif file_exists(e) then
				os.execute("rm -f " .. e)
			end
		end

		-- Remove symlink if not already handled
		if not is_windows() then
			os.execute("rm -f /usr/local/bin/predoc-gui")
		end

		-- Clean up empty parent dirs
		os.execute("rmdir " .. prefix .. "/bin 2>/dev/null")
		os.execute("rmdir " .. prefix .. " 2>/dev/null")

		print("  -> Removed from " .. prefix)
	end,
})
