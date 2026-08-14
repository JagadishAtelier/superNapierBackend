param (
    [string]$FilePath
)

$tempDir = Join-Path $env:TEMP "docx_temp_dir"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

try {
    $zipPath = Join-Path $env:TEMP "temp_doc.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Copy-Item -Path $FilePath -Destination $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $xmlPath = Join-Path $tempDir "word/document.xml"
    if (Test-Path $xmlPath) {
        [xml]$xml = Get-Content $xmlPath -Encoding UTF8
        # Extract inner text of all w:t tags to maintain structure
        $namespaces = @{w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        $texts = Select-Xml -Xml $xml -XPath "//w:t" -Namespace $namespaces | ForEach-Object { $_.Node.InnerText }
        $texts -join " "
    } else {
        Write-Error "word/document.xml not found in archive."
    }
} catch {
    Write-Error $_.Exception.Message
} finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
