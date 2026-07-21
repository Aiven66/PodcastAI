/**
 * Electron Builder afterPack 钩子
 *
 * 对 Mac .app bundle 做完整的 deep ad-hoc 签名
 * 修复 macOS Gatekeeper 显示"文件已损坏"的问题
 *
 * 原因：electron-builder 在 identity: null 时不会签名，
 * Electron 自带的 linker-signed 签名只覆盖可执行文件本身
 * （Sealed Resources=none），Gatekeeper 检查 bundle 时失败。
 *
 * 解决：用 codesign --force --deep --sign - 对整个 .app 做完整签名
 */
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  // 只对 Mac 平台签名
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appOutDir = context.appOutDir
  const productName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${productName}.app`)

  console.log(`\n[afterPack] Ad-hoc signing (deep): ${appPath}`)

  try {
    // 1. 删除 .app 内所有 AppleDouble 文件（._*）和 .DS_Store
    // 这些文件携带 resource fork，codesign 会拒绝
    execSync(`find "${appPath}" -name '._*' -delete 2>/dev/null || true`, { stdio: 'inherit' })
    execSync(`find "${appPath}" -name '.DS_Store' -delete 2>/dev/null || true`, { stdio: 'inherit' })

    // 2. 递归清除所有扩展属性（resource fork、Finder 信息、quarantine 等）
    execSync(`xattr -cr "${appPath}" 2>/dev/null || true`, { stdio: 'inherit' })

    // 3. 对整个 .app bundle 做 deep ad-hoc 签名
    // --force: 覆盖已有签名
    // --deep: 递归签名所有嵌套的 Mach-O 文件（.dylib, framework, helper apps）
    // --sign -: ad-hoc 签名（无需开发者证书）
    execSync(`codesign --force --deep --sign - "${appPath}"`, {
      stdio: 'inherit',
    })

    // 4. 验证签名
    console.log('[afterPack] Verifying signature...')
    const verifyResult = execSync(
      `codesign --verify --verbose=2 "${appPath}" 2>&1 || true`
    ).toString()
    console.log(verifyResult)

    // 5. 显示签名详情
    const displayResult = execSync(
      `codesign -dv --verbose=2 "${appPath}" 2>&1 || true`
    ).toString()
    console.log(displayResult)

    console.log('[afterPack] ✓ Ad-hoc signing completed successfully\n')
  } catch (err) {
    console.error('[afterPack] ✗ Ad-hoc signing failed:', err.message)
    throw err
  }
}
