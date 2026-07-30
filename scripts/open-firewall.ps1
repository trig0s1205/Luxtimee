$ports = @(3000, 3001)

foreach ($port in $ports) {
  $name = "Luxtime Dev $port"
  netsh advfirewall firewall delete rule name="$name" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port
}

Write-Host "Firewall listo para puertos $($ports -join ', ')."
