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
    // 0. v1.0.79: 删除指向绝对路径的软链（如 pretrained_models/CosyVoice2-0.5B -> /Users/xxx/...）
    // 这些软链是本机路径，用户机器上必然失效，且破坏 codesign + Gatekeeper 验证
    // 模型路径在运行时由 COSYVOICE_MODEL_DIR 环境变量提供，无需随包下的软链
    console.log('[afterPack] Step 0: Removing absolute-path symlinks before signing...')
    try {
      const symlinks = execSync(
        `find "${appPath}" -type l 2>/dev/null || true`,
        { stdio: 'pipe' }
      ).toString().split('\n').filter(Boolean)
      let removed = 0
      for (const link of symlinks) {
        try {
          const target = fs.readlinkSync(link)
          if (path.isAbsolute(target)) {
            fs.unlinkSync(link)
            removed++
            console.log(`  ✂ removed absolute symlink: ${link} -> ${target}`)
          }
        } catch {}
      }
      console.log(`[afterPack] Step 0 done: removed ${removed} absolute symlink(s)`)
    } catch (e) {
      console.log('[afterPack] Step 0 warning (non-fatal):', e.message)
    }

    // 1. 删除 .app 内所有 AppleDouble 文件（._*）和 .DS_Store
    console.log('[afterPack] Step 1: Cleaning AppleDouble files (._*) and .DS_Store...')
    run(`find "${appPath}" -name '._*' -print0 | xargs -0 rm -f 2>/dev/null || true`)
    run(`find "${appPath}" -name '.DS_Store' -print0 | xargs -0 rm -f 2>/dev/null || true`)

    // 1b. v1.0.38: 使用 dot_clean 合并清理 AppleDouble 资源分支
    // dot_clean 是 macOS 专用工具，能处理 xattr 无法清除的 resource fork
    console.log('[afterPack] Step 1b: Running dot_clean to merge AppleDouble files...')
    try {
      run(`dot_clean -m "${appPath}" 2>/dev/null || true`)
    } catch (e) {
      console.log('[afterPack] dot_clean warning (non-fatal):', e.message)
    }

    // 2. v1.0.36: 使用 xattr -cr 直接清除扩展属性，避免 ditto 复制需要双倍磁盘空间
    // ditto 方式会在 /tmp 创建完整副本（约 5GB），磁盘空间不足时失败
    // xattr -cr 可以递归清除所有扩展属性（包括 com.apple.provenance）
    console.log('[afterPack] Step 2: Clearing extended attributes via xattr -cr...')
    try {
      run(`xattr -cr "${appPath}" 2>/dev/null || true`)
    } catch (e) {
      console.log('[afterPack] xattr -cr warning (non-fatal):', e.message)
    }

    // 2b. v1.0.38: 使用 xargs 批量清除扩展属性（比 -exec 高效，避免进程表耗尽）
    // xattr -cr 有时无法清除某些 resource fork，批量处理更可靠
    console.log('[afterPack] Step 2b: Batch xattr cleanup via xargs...')
    try {
      // 使用 xargs 批量处理，每个 xattr 进程处理多个文件，避免 spawn 太多进程
      run(`find "${appPath}" -print0 | xargs -0 xattr -c 2>/dev/null || true`)
      // 对 .app 目录本身也清除
      run(`xattr -c "${appPath}" 2>/dev/null || true`)
    } catch (e) {
      console.log('[afterPack] Batch xattr warning (non-fatal):', e.message)
    }

    // 3. 对整个 .app bundle 做 deep ad-hoc 签名
    // v1.0.79: 清理(Step 2b 并发 xattr)与签名间存在竞态，重试 + 额外清理可稳定通过
    console.log('[afterPack] Step 3: Signing entire .app bundle (codesign --force --deep --sign -)...')
    let signed = false
    for (let attempt = 1; attempt <= 3 && !signed; attempt++) {
      try {
        execSync(`codesign --force --deep --sign - "${appPath}"`, {
          stdio: 'inherit',
        })
        signed = true
      } catch (e) {
        const msg = e && e.stderr ? e.stderr.toString() : String(e.message || e)
        console.error(`[afterPack] codesign attempt ${attempt} failed: ${msg}`)
        if (attempt < 3) {
          // 重试前再做一次清理 + 短暂等待并发 xattr 进程结束
          try { run(`xattr -cr "${appPath}" 2>/dev/null || true`) } catch {}
          try { run(`dot_clean -m "${appPath}" 2>/dev/null || true`) } catch {}
          execSync(`sleep 2`)
        }
      }
    }
    if (!signed) {
      throw new Error('codesign failed after 3 attempts')
    }

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
    // v1.0.38: 签名失败不再中断构建，仍生成未签名的 .app（用户可手动签名或通过 xattr 绕过 Gatekeeper）
    console.error('[afterPack] ⚠ Continuing build without signature (unsigned app will still work)')
  }
}
