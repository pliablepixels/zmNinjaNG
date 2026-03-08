### General Note
These binaries are provided for convenience. You are much better off building from source. If they don't work
for your environment (especially linux, which is well known for breaking glibc and other deps changing), build from source.
See [README](README.md)

### macOS
- The macOS build is signed using ZoneMinder certs. You may be to allow running external apps if prompted
- (You should no longer need Sentinel to bypass Gatekeeer)

### Windows
- **Unsigned Build**: SmartScreen may warn about an unrecognized app
- **Solution**: Click "More info" → "Run anyway"

### Linux
- **AppImage**: Make executable with `chmod +x zmNinjaNG-*.AppImage`, then run
- **DEB Package**: Install with `sudo dpkg -i zmNinjaNG-*.deb`
- **RPM Package**: Install with `sudo rpm -i zmNinjaNG-*.rpm`

### Android
- **Debug APK (signed)**: Enable "Install from Unknown Sources" in device settings
- **AAB Bundle**: For Google Play Store (requires signing)

## Important Notes

- **Self-signed certificates are not supported**. Use Let's Encrypt or other trusted certificates. Alternatively, use HTTP with WireGuard (this is what I use)
- **Push notifications**: Now works for iOS and Android
- **Event Server**: zmNinjaNG needs the new [EventServer 7+](https://zmeventnotificationv7.readthedocs.io/en/latest/). It may work with the old one. 

## Support

This is personal software with no official support. For issues or contributions, see the [GitHub repository](https://github.com/pliablepixels/zmNinjaNG).

---
