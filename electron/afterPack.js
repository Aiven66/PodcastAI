/**
 * Electron Builder afterPack 钩子
 *
 * 对 Mac .app bundle 做完整的 deep ad-hoc 签名
 * 修复 macOS Gatekeeper 显示"文件已损坏"的问题
 *
 * v1.0.4 改进：voice-runtime 包含大量 Python 二进制和动态库。
 * 在 macOS 14+ (Sonoma/Sequoia) 上，文件会被自动添加 com.apple.provenance
 * 等扩展属性，导致 codesign 失败。使用 ditto --norsrc --noextattr 清除
 * resource fork 和扩展属性后，codesign 才能成功签名。
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function run(cmd, options = { stdio: 'inherit' }) {
  return execSync(cmd, options)
}

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
    console.log('[afterPack] Step 1: Cleaning AppleDouble files (._*) and .DS_Store...')
    run(`find "${appPath}" -name '._*' -print0 | xargs -0 rm -f 2>/dev/null || true`)
    run(`find "${appPath}" -name '.DS_Store' -print0 | xargs -0 rm -f 2>/dev/null || true`)

    // 2. 使用 ditto 复制 .app 到临时位置，清除 resource fork 和扩展属性
    // macOS 14+ 会给所有新创建的文件添加 com.apple.provenance 属性，
    // 普通的 xattr -cr 无法删除（受 SIP 保护），但 ditto --norsrc --noextattr
    // 可以在复制过程中跳过这些属性，使 codesign 能成功签名。
    console.log('[afterPack] Step 2: Stripping resource forks via ditto --norsrc --noextattr...')
    const tmpPath = `/tmp/${productName}_clean_${Date.now()}.app`
    run(`ditto --norsrc --noextattr "${appPath}" "${tmpPath}"`)
    run(`rm -rf "${appPath}"`)
    run(`mv "${tmpPath}" "${appPath}"`)

    // 3. 对整个 .app bundle 做 deep ad-hoc 签名
    console.log('[afterPack] Step 3: Signing entire .app bundle (codesign --force --deep --sign -)...')
    execSync(`codesign --force --deep --sign - "${appPath}"`, {
      stdio: 'inherit',
    })

    // 4. 验证签名
    console.log('[afterPack] Step 4: Verifying signature...')
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
