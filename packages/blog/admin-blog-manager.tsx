'use client';

/**
 * @clipop/blog - Admin Blog Manager
 *
 * 参考 clipopai 管理后台「博客管理」的整页双模式实现：
 *   - 列表页：卡片行（封面 / 标题 / 分类 / 时间 / 浏览数 / 状态）+ 分页，
 *     支持编辑 / 删除 / 发布切换 / 翻译，以及「一键全部分类」「新增博客」。
 *   - 编辑页：整页（非弹窗），顶部「← 返回文章列表」，双模式 Tab：
 *       传统编辑器（标题 + 分类 + 封面 + 富文本）/
 *       HTML 上传模式（HTML 文件 + 封面 + 多张配图，服务端清理并发布）。
 *     底部提供「预览发布效果」与「发布文章」。
 *   - 「按文章内容自动提炼分类」复选框（默认勾选），保存时调用
 *     /api/blog/auto-category 自动提炼分类。
 *
 * No shadcn/ui — pure native HTML + Tailwind.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppConfig, type BlogPost, type Locale } from '../core';
import {
  fetchBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  translateBlogPost,
  publishHtmlBlog,
  autoCategorizeBlogPost,
  autoCategorizeAllBlogPosts,
} from './client';
import { CoverUploader } from './cover-uploader';
import { RichTextEditor } from './rich-text-editor';
import { sanitizeHtmlContent } from './sanitize';

export interface AdminBlogManagerProps {
  /** Bearer token for API calls. */
  token: string;
  /** Display locale. Default: config.defaultLocale. */
  locale?: Locale;
  /** Override the editor's placeholder text. */
  editorPlaceholder?: string;
}

interface EditorState {
  id: string | null;
  title: string;
  category: string;
  content: string;
  coverImage: string;
  published: boolean;
}

type EditorMode = 'rich' | 'html';

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: '',
  category: '',
  content: '',
  coverImage: '',
  published: true,
};

const PAGE_SIZE = 10;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 解析上传的 HTML / 文本文件为 { title, content }：
 *   - HTML：优先取 <title> / <body>；
 *   - 纯文本（.txt）：按空行分段包装为 <p>，保留换行。
 */
function parseHtmlDocument(raw: string): { title: string; content: string } {
  const looksLikeHtml = /<[a-z!/]/i.test(raw);
  if (!looksLikeHtml) {
    const content = raw
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
      .join('');
    return { title: '', content };
  }
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const title = (doc.title || '').trim();
    const bodyHtml = doc.body ? doc.body.innerHTML.trim() : '';
    if (bodyHtml) return { title, content: bodyHtml };
  } catch {
    // fallthrough：非结构化 HTML 按纯文本处理
  }
  return { title: '', content: raw.trim() };
}

export function AdminBlogManager({
  token,
  locale,
  editorPlaceholder,
}: AdminBlogManagerProps) {
  const config = useAppConfig();
  const displayLocale = locale || config.defaultLocale || 'en';
  const isZh = displayLocale === 'zh';
  const defaultCategory = config.blogDefaultCategory || (isZh ? '未分类' : 'General');

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // 列表 / 编辑页切换
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [mode, setMode] = useState<EditorMode>('rich');
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [autoCategory, setAutoCategory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [categorizingAll, setCategorizingAll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // HTML 上传模式专属状态
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const showFeedback = useCallback((kind: 'success' | 'error', message: string) => {
    setFeedback({ kind, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadPosts = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        // 管理后台需要看到草稿：includeUnpublished + 管理员 token（服务端校验）
        const result = await fetchBlogPosts(
          config,
          { page: targetPage, pageSize: PAGE_SIZE, locale: displayLocale, includeUnpublished: true },
          token,
        );
        // 末页被删空时自动回退一页
        if (result.posts.length === 0 && targetPage > 1) {
          const prev = await fetchBlogPosts(
            config,
            { page: targetPage - 1, pageSize: PAGE_SIZE, locale: displayLocale, includeUnpublished: true },
            token,
          );
          setPosts(prev.posts);
          setTotal(prev.total);
          setPage(targetPage - 1);
          return;
        }
        setPosts(result.posts);
        setTotal(result.total);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    },
    [config, displayLocale, token],
  );

  useEffect(() => {
    loadPosts(1);
  }, [loadPosts]);

  const resetHtmlMode = useCallback(() => {
    setHtmlFile(null);
    setHtmlPreviewContent('');
    setCoverFile(null);
    setCoverPreview('');
    setExtraFiles([]);
  }, []);

  const handleNewPost = useCallback(() => {
    setEditor({ ...EMPTY_EDITOR, category: defaultCategory, published: true });
    setAutoCategory(true);
    setMode('rich');
    resetHtmlMode();
    setView('editor');
  }, [defaultCategory, resetHtmlMode]);

  const handleEdit = useCallback(
    (post: BlogPost) => {
      setEditor({
        id: post.id,
        title: post.title,
        category: post.category || defaultCategory,
        content: post.content,
        coverImage: post.coverImage || '',
        published: post.isPublished !== false,
      });
      setAutoCategory(false);
      setMode('rich');
      resetHtmlMode();
      setView('editor');
    },
    [defaultCategory, resetHtmlMode],
  );

  const backToList = useCallback(() => {
    setView('list');
    void loadPosts(page);
  }, [loadPosts, page]);

  // ── HTML 上传模式：选择文件后自动填充标题并按需提炼分类 ──
  const handlePickHtml = useCallback(
    async (file: File) => {
      setHtmlFile(file);
      try {
        const raw = await file.text();
        const { title, content } = parseHtmlDocument(raw);
        setHtmlPreviewContent(content);
        if (title) {
          setEditor((prev) => ({ ...prev, title: prev.title.trim() ? prev.title : title }));
        }
        if (autoCategory && content.trim()) {
          try {
            const { category } = await autoCategorizeBlogPost(
              config,
              { title: title || file.name, content },
              token,
            );
            if (category) {
              setEditor((prev) => ({ ...prev, category: prev.category.trim() ? prev.category : category }));
            }
          } catch {
            // 自动分类失败不阻断上传流程
          }
        }
      } catch {
        showFeedback('error', isZh ? '读取文件失败' : 'Failed to read file');
      }
    },
    [autoCategory, config, token, isZh, showFeedback],
  );

  const handlePickCover = useCallback((file: File) => {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }, []);

  const handleAddExtra = useCallback((files: FileList | File[]) => {
    setExtraFiles((prev) => [
      ...prev,
      ...Array.from(files).filter((f) => f.type?.startsWith('image/')),
    ]);
  }, []);

  // ── 保存：传统编辑器模式（创建 / 更新） ──
  const handleSaveRich = useCallback(async () => {
    if (!editor.title.trim() || !editor.content.trim()) {
      showFeedback('error', isZh ? '标题和内容必填' : 'Title and content are required');
      return;
    }
    setSaving(true);
    try {
      let category = editor.category.trim() || defaultCategory;
      if (autoCategory && editor.content.trim()) {
        try {
          const result = await autoCategorizeBlogPost(
            config,
            { title: editor.title, content: editor.content },
            token,
          );
          if (result.category) category = result.category;
        } catch {
          // 自动分类失败时沿用已有/默认分类
        }
      }

      if (editor.id) {
        await updateBlogPost(
          config,
          {
            id: editor.id,
            title: editor.title,
            category,
            content: editor.content,
            coverImage: editor.coverImage,
            publish: editor.published,
          },
          token,
        );
        showFeedback('success', isZh ? '更新成功' : 'Updated');
      } else {
        await createBlogPost(
          config,
          {
            title: editor.title,
            category,
            content: editor.content,
            coverImage: editor.coverImage,
            publish: editor.published,
          },
          token,
        );
        showFeedback('success', isZh ? '创建成功' : 'Created');
      }
      setView('list');
      await loadPosts(1);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [editor, autoCategory, config, token, defaultCategory, isZh, showFeedback, loadPosts]);

  // ── 保存：HTML 上传模式（一步式发布，新建专属） ──
  const handlePublishHtml = useCallback(async () => {
    if (!htmlFile) {
      showFeedback('error', isZh ? '请先选择 HTML 文件' : 'Please select an HTML file first');
      return;
    }
    setSaving(true);
    try {
      let category = editor.category.trim() || defaultCategory;
      if (autoCategory && htmlPreviewContent.trim()) {
        try {
          const result = await autoCategorizeBlogPost(
            config,
            { title: editor.title, content: htmlPreviewContent },
            token,
          );
          if (result.category) category = result.category;
        } catch {
          // ignore
        }
      }

      const form = new FormData();
      form.append('title', editor.title.trim() || htmlFile.name.replace(/\.[^.]+$/, '') || 'Untitled');
      form.append('category', category);
      form.append('htmlFile', htmlFile);
      if (coverFile) form.append('coverFile', coverFile);
      // 附加图片：服务端按文件名替换 HTML 中相对路径的 <img src>。
      extraFiles.forEach((f) => form.append(`img_${f.name}`, f));

      await publishHtmlBlog(config, form, token);
      showFeedback('success', isZh ? 'HTML 文章已发布' : 'HTML post published');
      setView('list');
      await loadPosts(1);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  }, [
    htmlFile,
    editor.title,
    editor.category,
    autoCategory,
    htmlPreviewContent,
    coverFile,
    extraFiles,
    config,
    token,
    defaultCategory,
    isZh,
    showFeedback,
    loadPosts,
  ]);

  const handleDelete = useCallback(
    async (post: BlogPost) => {
      if (!confirm(isZh ? `确定删除「${post.title}」？` : `Delete "${post.title}"?`)) return;
      try {
        await deleteBlogPost(config, post.id, token);
        showFeedback('success', isZh ? '已删除' : 'Deleted');
        await loadPosts(page);
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [config, token, isZh, showFeedback, loadPosts, page],
  );

  const handleTogglePublish = useCallback(
    async (post: BlogPost) => {
      try {
        await updateBlogPost(config, { id: post.id, publish: !post.isPublished }, token);
        await loadPosts(page);
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Update failed');
      }
    },
    [config, token, loadPosts, page, showFeedback],
  );

  const handleTranslate = useCallback(
    async (post: BlogPost) => {
      setTranslating(post.id);
      try {
        const result = await translateBlogPost(config, post.id, post.authorId || undefined, token);
        showFeedback(
          'success',
          isZh ? `翻译完成：${result.translated} 种语言` : `Translated to ${result.translated} languages`,
        );
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Translation failed');
      } finally {
        setTranslating(null);
      }
    },
    [config, token, isZh, showFeedback],
  );

  const handleCategorizeAll = useCallback(async () => {
    setCategorizingAll(true);
    try {
      const result = await autoCategorizeAllBlogPosts(config, token);
      showFeedback(
        'success',
        isZh
          ? `已完成分类：更新 ${result.updated} / 共 ${result.total} 篇`
          : `Categorized: ${result.updated} of ${result.total} posts`,
      );
      await loadPosts(page);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Categorize failed');
    } finally {
      setCategorizingAll(false);
    }
  }, [config, token, isZh, showFeedback, loadPosts, page]);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: isZh ? 'numeric' : 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i += 1) arr.push(i);
    return arr;
  }, [page, totalPages]);

  const previewTitle = editor.title.trim() || (isZh ? '未命名文章' : 'Untitled');
  const previewContent = mode === 'html' ? htmlPreviewContent : editor.content;
  const previewCover = mode === 'html' ? coverPreview : editor.coverImage;
  const canPreview = previewContent.trim().length > 0;

  const feedbackBanner = feedback && (
    <div
      className={`rounded-lg p-3 text-sm ${
        feedback.kind === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {feedback.message}
    </div>
  );

  // ════════════════════ 编辑页（整页） ════════════════════
  if (view === 'editor') {
    const isNew = !editor.id;
    const primaryLabel = isNew
      ? isZh ? '发布文章' : 'Publish Post'
      : isZh ? '保存修改' : 'Save Changes';

    return (
      <div className="space-y-6">
        {feedbackBanner}

        <button
          type="button"
          onClick={backToList}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← {isZh ? '返回文章列表' : 'Back to list'}
        </button>

        <div>
          <h1 className="text-2xl font-bold">
            {isNew ? (isZh ? '发布新博客' : 'New Blog Post') : isZh ? '编辑博客' : 'Edit Blog Post'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'rich'
              ? isZh
                ? '填写文章信息并发布到平台'
                : 'Fill in the article info and publish to the platform'
              : isZh
                ? '上传 HTML 文件与配图，发布到平台'
                : 'Upload an HTML file with images and publish to the platform'}
          </p>
        </div>

        {/* 模式切换：编辑已有文章时不提供 HTML 上传模式（服务端仅支持一步式新建发布） */}
        {isNew && (
          <div className="inline-flex gap-1 rounded-lg border border-border p-1">
            {(['rich', 'html'] as EditorMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {m === 'rich' ? (isZh ? '传统编辑器' : 'Rich Editor') : isZh ? 'HTML 上传模式' : 'HTML Upload'}
              </button>
            ))}
          </div>
        )}

        {mode === 'rich' ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <section className="space-y-4 rounded-xl border border-border p-5">
                <div>
                  <h2 className="font-semibold">{isZh ? '文章信息' : 'Article Info'}</h2>
                  <p className="text-xs text-muted-foreground">
                    {isZh ? '输入文章标题与内容，发布到平台' : 'Enter the title and content, then publish'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isZh ? '文章标题' : 'Title'}</label>
                  <input
                    type="text"
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={isZh ? '输入文章标题' : 'Enter the article title'}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{isZh ? '分类' : 'Category'}</label>
                  <input
                    type="text"
                    value={editor.category}
                    onChange={(e) => setEditor({ ...editor, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={defaultCategory}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoCategory}
                      onChange={(e) => setAutoCategory(e.target.checked)}
                    />
                    {isZh
                      ? '按文章内容自动提炼分类（推荐）'
                      : 'Auto-extract category from content (recommended)'}
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {isZh ? '文章内容（富文本编辑器）' : 'Content (rich text editor)'}
                  </label>
                  <RichTextEditor
                    key={editor.id || 'new-rich'}
                    value={editor.content}
                    onChange={(html) => setEditor((prev) => ({ ...prev, content: html }))}
                    locale={isZh ? 'zh' : 'en'}
                    placeholder={editorPlaceholder}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editor.published}
                    onChange={(e) => setEditor({ ...editor, published: e.target.checked })}
                  />
                  {isZh ? '立即发布' : 'Publish immediately'}
                </label>
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!canPreview}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isZh ? '预览发布效果' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveRich}
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (isZh ? '保存中...' : 'Saving...') : primaryLabel}
                </button>
              </div>
            </div>

            <aside className="space-y-6">
              <section className="rounded-xl border border-border p-5">
                <CoverUploader
                  value={editor.coverImage}
                  onChange={(url) => setEditor((prev) => ({ ...prev, coverImage: url }))}
                  token={token}
                  locale={isZh ? 'zh' : 'en'}
                  label={isZh ? '封面图片（支持本地上传）' : 'Cover Image (local upload)'}
                />
              </section>
            </aside>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <section className="space-y-4 rounded-xl border border-border p-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '文章标题' : 'Title'}</label>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={
                    isZh ? '上传 HTML 文件后自动填充标题' : 'Auto-filled after uploading an HTML file'
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '分类' : 'Category'}</label>
                <input
                  type="text"
                  value={editor.category}
                  onChange={(e) => setEditor({ ...editor, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={defaultCategory}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={autoCategory}
                    onChange={(e) => setAutoCategory(e.target.checked)}
                  />
                  {isZh
                    ? '按文章内容自动提炼分类（推荐）'
                    : 'Auto-extract category from content (recommended)'}
                </label>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-border p-5">
              <label className="text-sm font-medium">
                {isZh ? '上传 HTML 内容文件' : 'Upload HTML content file'}
              </label>
              <button
                type="button"
                onClick={() => htmlFileInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition hover:bg-muted"
              >
                {htmlFile ? (
                  <span className="truncate font-medium text-foreground">{htmlFile.name}</span>
                ) : (
                  <span>
                    {isZh ? '拖拽 HTML 文件到此处 / 或点击选择文件' : 'Drop an HTML file here / or click to choose'}
                    <span className="ml-1 text-xs">(.html, .htm, .txt)</span>
                  </span>
                )}
              </button>
              <input
                ref={htmlFileInputRef}
                type="file"
                accept=".html,.htm,.txt,text/html,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePickHtml(f);
                  e.target.value = '';
                }}
              />
            </section>

            <section className="space-y-2 rounded-xl border border-border p-5">
              <label className="text-sm font-medium">{isZh ? '封面图片' : 'Cover image'}</label>
              <div className="flex items-center gap-3">
                {coverPreview && (
                  <img src={coverPreview} alt="cover" className="h-16 w-24 flex-none rounded-lg object-cover" />
                )}
                <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground hover:bg-muted">
                  {coverFile ? coverFile.name : isZh ? '拖拽图片到此处 / 或点击选择' : 'Drop an image / or click to choose'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePickCover(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-border p-5">
              <label className="text-sm font-medium">
                {isZh ? '其他配图（可选，支持多选）' : 'Other images (optional, multi-select)'}
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground hover:bg-muted">
                <span>{isZh ? '拖拽配图到此处（可多张）/ 或点击选择多张图片' : 'Drop images here / or click to select multiple'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleAddExtra(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {extraFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs"
                    >
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setExtraFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                disabled={!canPreview}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isZh ? '预览发布效果' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={handlePublishHtml}
                disabled={saving || !htmlFile}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (isZh ? '发布中...' : 'Publishing...') : isZh ? '发布文章' : 'Publish Post'}
              </button>
            </div>
          </div>
        )}

        {/* 预览弹窗（发布效果） */}
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
            <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-background p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{isZh ? '预览发布效果' : 'Preview'}</h2>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {previewCover && (
                <img src={previewCover} alt="cover" className="mb-4 h-48 w-full rounded-lg object-cover" />
              )}
              {editor.category.trim() && (
                <span className="mb-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {editor.category}
                </span>
              )}
              <h1 className="mb-4 text-2xl font-bold">{previewTitle}</h1>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(previewContent) }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════ 列表页 ════════════════════
  return (
    <div className="space-y-6">
      {feedbackBanner}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isZh ? '博客管理' : 'Blog Manager'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? '管理平台所有已发布文章' : 'Manage all published articles'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCategorizeAll}
            disabled={categorizingAll}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            ⟳ {categorizingAll ? (isZh ? '分类中...' : 'Categorizing...') : isZh ? '一键全部分类' : 'Categorize All'}
          </button>
          <button
            type="button"
            onClick={handleNewPost}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + {isZh ? '新增博客' : 'New Post'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {isZh ? '暂无文章，点击「新增博客」开始创作' : 'No posts yet. Click "New Post" to start.'}
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm md:flex-row md:items-center"
            >
              <div className="h-16 w-24 flex-none overflow-hidden rounded-lg bg-muted">
                <img
                  src={post.coverImage || 'https://picsum.photos/seed/admin-default/120/80'}
                  alt={post.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{post.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {post.category && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                      {post.category}
                    </span>
                  )}
                  {formatDate(post.createdAt) && (
                    <span>📅 {formatDate(post.createdAt)}</span>
                  )}
                  <span>👁 {post.viewCount ?? 0}</span>
                  {post.isPublished ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                      {isZh ? '已发布' : 'Published'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
                      {isZh ? '草稿' : 'Draft'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-none flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTranslate(post)}
                  disabled={translating === post.id}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {translating === post.id ? (isZh ? '翻译中...' : 'Translating...') : isZh ? '翻译' : 'Translate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePublish(post)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  {post.isPublished ? (isZh ? '取消发布' : 'Unpublish') : isZh ? '发布' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(post)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  {isZh ? '编辑' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(post)}
                  className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/5"
                >
                  {isZh ? '删除' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => loadPosts(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
          >
            {isZh ? '上一页' : 'Prev'}
          </button>

          <div className="flex flex-wrap items-center gap-1">
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => loadPosts(n)}
                className={`min-w-[2rem] rounded-lg border px-2.5 py-1.5 text-sm transition ${
                  n === page
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {isZh ? `第 ${page}/${totalPages} 页` : `Page ${page} of ${totalPages}`}
            </span>
            <button
              type="button"
              onClick={() => loadPosts(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
            >
              {isZh ? '下一页' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}