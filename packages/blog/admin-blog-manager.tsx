'use client';

/**
 * @clipop/blog - Admin Blog Manager
 *
 * Lists all blog posts (including unpublished) with edit/delete/publish
 * actions. Provides a "New Post" form (title + category + cover uploader +
 * rich text editor + publish checkbox) and a "Translate" button that triggers
 * the host app's /api/blog/translate endpoint.
 *
 * No shadcn/ui — pure native HTML + Tailwind.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppConfig, type BlogPost, type Locale } from '../core';
import {
  fetchBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  translateBlogPost,
  publishHtmlBlog,
} from './client';
import { CoverUploader } from './cover-uploader';
import { RichTextEditor } from './rich-text-editor';

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

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: '',
  category: '',
  content: '',
  coverImage: '',
  published: true,
};

/**
 * 解析上传的 HTML 文件为 { title, content }：
 * 优先取 <title> / <body>；无结构时回退整段文本。
 * 相对路径引用的图片无法内联，导入后需在编辑器中检查图片显示。
 */
function parseHtmlDocument(raw: string): { title: string; content: string } {
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

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 管理后台需要看到草稿：includeUnpublished + 管理员 token（服务端校验）
      const result = await fetchBlogPosts(
        config,
        { page: 1, pageSize: 100, locale: displayLocale, includeUnpublished: true },
        token,
      );
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [config, displayLocale, token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const showFeedback = useCallback((kind: 'success' | 'error', message: string) => {
    setFeedback({ kind, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // 上传 HTML 文件导入：读取 → 解析 <title>/<body> → 填充编辑器（可在保存前继续编辑）
  const htmlFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportHtmlFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const { title, content } = parseHtmlDocument(raw);
        if (!content) {
          showFeedback('error', isZh ? 'HTML 文件内容为空' : 'HTML file is empty');
          return;
        }
        setEditor((prev) => ({
          ...prev,
          title: prev.title.trim() ? prev.title : title,
          content,
        }));
        showFeedback(
          'success',
          isZh
            ? 'HTML 已导入，请检查标题、封面与图片后保存'
            : 'HTML imported. Review title, cover and images before saving',
        );
      } catch {
        showFeedback('error', isZh ? '读取 HTML 文件失败' : 'Failed to read HTML file');
      }
    },
    [isZh, showFeedback],
  );

  // ===== 一步式「上传 HTML 发布」：HTML 文件 + 封面 + 附加图片 → 直接发布 =====
  // 调用宿主应用 /api/blog/html-publish（服务端统一清理 HTML、上传图片、写入博客）。
  // 与编辑器内的「上传 HTML 文件」（解析到正文后继续编辑）互补：本入口发布即生效。
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubCategory, setPubCategory] = useState('');
  const [pubHtmlFile, setPubHtmlFile] = useState<File | null>(null);
  const [pubCoverFile, setPubCoverFile] = useState<File | null>(null);
  const [pubExtraFiles, setPubExtraFiles] = useState<File[]>([]);
  const [pubCoverPreview, setPubCoverPreview] = useState<string>('');
  const [pubSaving, setPubSaving] = useState(false);

  const openPublish = useCallback(() => {
    setPubTitle('');
    setPubCategory(config.blogDefaultCategory || '');
    setPubHtmlFile(null);
    setPubCoverFile(null);
    setPubExtraFiles([]);
    setPubCoverPreview('');
    setPublishOpen(true);
  }, [config.blogDefaultCategory]);

  const handlePickHtml = useCallback(
    (file: File) => {
      setPubHtmlFile(file);
      // 用 HTML <title> 自动填充标题（用户仍可修改）。
      if (!pubTitle.trim()) {
        file
          .text()
          .then((raw) => {
            const { title } = parseHtmlDocument(raw);
            if (title) setPubTitle(title.trim());
          })
          .catch(() => {});
      }
    },
    [pubTitle],
  );

  const handlePickCover = useCallback((file: File) => {
    setPubCoverFile(file);
    setPubCoverPreview(URL.createObjectURL(file));
  }, []);

  const handleDropExtra = useCallback((files: FileList | File[]) => {
    setPubExtraFiles((prev) => [...prev, ...Array.from(files).filter((f) => f.type?.startsWith('image/'))]);
  }, []);

  const handlePublishHtmlSubmit = useCallback(async () => {
    if (!pubHtmlFile) {
      showFeedback('error', isZh ? '请先选择 HTML 文件' : 'Please select an HTML file first');
      return;
    }
    setPubSaving(true);
    try {
      const form = new FormData();
      form.append('title', pubTitle.trim() || 'Untitled');
      form.append('category', pubCategory.trim() || config.blogDefaultCategory || 'General');
      form.append('htmlFile', pubHtmlFile);
      if (pubCoverFile) form.append('coverFile', pubCoverFile);
      // 附加图片：服务端会按文件名替换 HTML 中相对路径的 <img src>。
      pubExtraFiles.forEach((f) => form.append(`img_${f.name}`, f));
      await publishHtmlBlog(config, form, token);
      showFeedback('success', isZh ? 'HTML 文章已发布' : 'HTML post published');
      setPublishOpen(false);
      await loadPosts();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPubSaving(false);
    }
  }, [pubHtmlFile, pubTitle, pubCategory, pubCoverFile, pubExtraFiles, config, token, isZh, showFeedback, loadPosts]);

  const handleNewPost = useCallback(() => {
    setEditor({
      ...EMPTY_EDITOR,
      category: config.blogDefaultCategory || '',
      published: true,
    });
    setEditorOpen(true);
  }, [config.blogDefaultCategory]);

  const handleEdit = useCallback((post: BlogPost) => {
    setEditor({
      id: post.id,
      title: post.title,
      category: post.category,
      content: post.content,
      coverImage: post.coverImage || '',
      published: post.isPublished !== false,
    });
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editor.title.trim() || !editor.content.trim()) {
      showFeedback('error', isZh ? '标题和内容必填' : 'Title and content are required');
      return;
    }

    setSaving(true);
    try {
      if (editor.id) {
        await updateBlogPost(config, {
          id: editor.id,
          title: editor.title,
          category: editor.category || config.blogDefaultCategory,
          content: editor.content,
          coverImage: editor.coverImage,
          publish: editor.published,
        }, token);
        showFeedback('success', isZh ? '更新成功' : 'Updated');
      } else {
        await createBlogPost(config, {
          title: editor.title,
          category: editor.category || config.blogDefaultCategory,
          content: editor.content,
          coverImage: editor.coverImage,
          publish: editor.published,
        }, token);
        showFeedback('success', isZh ? '创建成功' : 'Created');
      }
      setEditorOpen(false);
      await loadPosts();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [editor, config, token, isZh, showFeedback, loadPosts]);

  const handleDelete = useCallback(
    async (post: BlogPost) => {
      if (!confirm(isZh ? `确定删除「${post.title}」？` : `Delete "${post.title}"?`)) return;
      try {
        await deleteBlogPost(config, post.id, token);
        showFeedback('success', isZh ? '已删除' : 'Deleted');
        await loadPosts();
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [config, token, isZh, showFeedback, loadPosts],
  );

  const handleTogglePublish = useCallback(
    async (post: BlogPost) => {
      try {
        await updateBlogPost(config, {
          id: post.id,
          publish: !post.isPublished,
        }, token);
        await loadPosts();
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Update failed');
      }
    },
    [config, token, loadPosts, showFeedback],
  );

  const handleTranslate = useCallback(
    async (post: BlogPost) => {
      setTranslating(post.id);
      try {
        const result = await translateBlogPost(config, post.id, post.authorId || undefined, token);
        const successCount = result.translated;
        showFeedback(
          'success',
          isZh
            ? `翻译完成：${successCount} 种语言`
            : `Translated to ${successCount} languages`,
        );
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Translation failed');
      } finally {
        setTranslating(null);
      }
    },
    [config, token, isZh, showFeedback],
  );

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-lg p-3 text-sm ${
            feedback.kind === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{isZh ? '博客管理' : 'Blog Manager'}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPublish}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            ↑ {isZh ? '上传 HTML 发布' : 'Upload HTML & Publish'}
          </button>
          <button
            type="button"
            onClick={handleNewPost}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + {isZh ? '新文章' : 'New Post'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isZh ? '暂无文章' : 'No posts yet'}
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 flex-none overflow-hidden rounded">
                  <img
                    src={post.coverImage || 'https://picsum.photos/seed/admin-default/100/100'}
                    alt={post.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 font-medium">{post.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {post.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5">{post.category}</span>
                    )}
                    <span>{formatDate(post.createdAt)}</span>
                    <span>{post.viewCount ?? 0} views</span>
                    {post.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                        {isZh ? '已发布' : 'Published'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
                        {isZh ? '草稿' : 'Draft'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTranslate(post)}
                  disabled={translating === post.id}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {translating === post.id
                    ? isZh ? '翻译中...' : 'Translating...'
                    : isZh ? '翻译' : 'Translate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePublish(post)}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  {post.isPublished
                    ? isZh ? '取消发布' : 'Unpublish'
                    : isZh ? '发布' : 'Publish'}
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

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditorOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editor.id ? (isZh ? '编辑文章' : 'Edit Post') : (isZh ? '新文章' : 'New Post')}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '标题' : 'Title'}</label>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={isZh ? '输入标题' : 'Enter title'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '分类' : 'Category'}</label>
                <input
                  type="text"
                  value={editor.category}
                  onChange={(e) => setEditor({ ...editor, category: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={config.blogDefaultCategory || (isZh ? '输入分类' : 'Enter category')}
                />
              </div>

              <CoverUploader
                value={editor.coverImage}
                onChange={(url) => setEditor({ ...editor, coverImage: url })}
                token={token}
                locale={isZh ? 'zh' : 'en'}
                label={isZh ? '封面图片' : 'Cover Image'}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{isZh ? '正文' : 'Content'}</label>
                  <button
                    type="button"
                    onClick={() => htmlFileInputRef.current?.click()}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    title={isZh ? '上传 .html 文件，自动提取标题与正文' : 'Upload a .html file, extracting title & body'}
                  >
                    {isZh ? '上传 HTML 文件' : 'Upload HTML'}
                  </button>
                  <input
                    ref={htmlFileInputRef}
                    type="file"
                    accept=".html,.htm,text/html"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportHtmlFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                <RichTextEditor
                  value={editor.content}
                  onChange={(html) => setEditor({ ...editor, content: html })}
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (isZh ? '保存中...' : 'Saving...') : isZh ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 一步式「上传 HTML 发布」弹窗 ===== */}
      {publishOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPublishOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isZh ? '上传 HTML 直接发布' : 'Publish HTML Article'}</h2>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              {isZh
                ? '选择 HTML 文件后：服务端自动清理代码、上传正文图片与封面，并立即发布（不可取消）。'
                : 'Choose an HTML file: the server sanitizes it, uploads inline images & cover, and publishes immediately.'}
            </p>

            <div className="space-y-4">
              {/* HTML 文件 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {isZh ? 'HTML 文件' : 'HTML file'} <span className="text-destructive">*</span>
                </label>
                <label
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-muted"
                >
                  {pubHtmlFile ? (
                    <span className="truncate font-medium text-foreground">{pubHtmlFile.name}</span>
                  ) : (
                    <span>{isZh ? '点击选择 .html 文件' : 'Click to choose a .html file'}</span>
                  )}
                  <input
                    type="file"
                    accept=".html,.htm,text/html"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePickHtml(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* 标题 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '标题（可编辑）' : 'Title (editable)'}</label>
                <input
                  type="text"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={isZh ? '自动从 HTML <title> 提取' : 'Auto-extracted from the HTML <title>'}
                />
              </div>

              {/* 分类 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '分类' : 'Category'}</label>
                <input
                  type="text"
                  value={pubCategory}
                  onChange={(e) => setPubCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={config.blogDefaultCategory || (isZh ? '输入分类' : 'Enter category')}
                />
              </div>

              {/* 封面 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{isZh ? '封面图片' : 'Cover image'}（{isZh ? '可选' : 'optional'}）</label>
                <div className="flex items-center gap-3">
                  {pubCoverPreview && (
                    <img src={pubCoverPreview} alt="cover" className="h-16 w-24 flex-none rounded object-cover" />
                  )}
                  <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground hover:bg-muted">
                    {pubCoverFile ? pubCoverFile.name : isZh ? '选择封面图片' : 'Choose a cover image'}
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
              </div>

              {/* 附加图片 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {isZh ? '正文附加图片' : 'Inline images'}（{isZh ? '可选，按文件名替换 HTML 内 <img>' : 'optional, matched to <img> by filename'}）
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted">
                  <span>{isZh ? '添加图片（可多选）' : 'Add images (multi-select)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleDropExtra(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                {pubExtraFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pubExtraFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs">
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setPubExtraFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPublishOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handlePublishHtmlSubmit}
                  disabled={pubSaving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pubSaving
                    ? isZh ? '发布中...' : 'Publishing...'
                    : isZh ? '立即发布' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
