import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react/dist/iconify.js";
import Swal from "sweetalert2";
import MasterLayout from "../otherImages/MasterLayout";
import BlogContentEditor, { isBlogContentEmpty } from "../components/BlogContentEditor";
import EloquentImage from "../components/EloquentImage";
import EloquentMedia from "../components/EloquentMedia";
import {
  addBlogImages,
  deleteBlogImage,
  fetchBlogs,
  fetchCategories,
  getAuthToken,
  updateBlog,
} from "../api/eloquentApi";
import {
  addGalleryWatermark,
  addWatermarkToFiles,
  GALLERY_WATERMARK_ENABLED,
} from "../utils/watermarkImage";

const swalOptions = {
  background: "#1e1e1e",
  color: "#f5f8fa",
  confirmButtonColor: "#3b586e",
  customClass: { popup: "eloquent-swal-popup" },
};

function stripManagedImages(content = "") {
  const START = "<!-- eloquent-blog-images:start -->";
  const END = "<!-- eloquent-blog-images:end -->";
  const si = content.indexOf(START);
  const ei = content.indexOf(END);
  if (si === -1 || ei === -1 || ei < si) return content.trim();
  return `${content.slice(0, si)}${content.slice(ei + END.length)}`.trim();
}

function getBlogImages(blog) {
  const media = blog?.images || blog?.blogImages || blog?.galleryImages || [];
  return Array.isArray(media) ? media.filter((item) => item?.imageUrl || item?.url) : [];
}

function getImageUrl(img) {
  return img?.imageUrl || img?.url || "";
}

function SelectedFilePreview({ alt, file }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <EloquentMedia alt={alt} controls={false} mediaType={file?.type} src={src} />;
}

const EloquentBlogEditPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [blog, setBlog] = useState(null);
  const [categories, setCategories] = useState(location.state?.categories || []);
  const [form, setForm] = useState({
    title: "",
    categoryId: "",
    featuredImage: null,
    content: "",
    newGalleryImages: [],
    status: "ACTIVE",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [galleryStep, setGalleryStep] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allBlogs, allCats] = await Promise.all([
          fetchBlogs(),
          fetchCategories(),
        ]);
        const found = allBlogs.find((b) => String(b.id) === String(id));
        if (!found) {
          await Swal.fire({ ...swalOptions, icon: "error", title: "Blog not found" });
          navigate("/blogs");
          return;
        }
        setBlog(found);
        setCategories([...allCats].reverse());
      } catch (err) {
        await Swal.fire({ ...swalOptions, icon: "error", title: "Load failed", text: err.message });
        navigate("/blogs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  useEffect(() => {
    if (blog) {
      setForm({
        title: blog.title || "",
        categoryId: String(blog.categoryId || blog.category?.id || ""),
        featuredImage: null,
        content: stripManagedImages(blog.content || ""),
        newGalleryImages: [],
        status: blog.status || "ACTIVE",
      });
    }
  }, [blog]);

  const handleChange = (event) => {
    const { name, type, value, files } = event.target;
    if (type === "file") {
      if (name === "newGalleryImages") {
        setForm((c) => ({ ...c, newGalleryImages: Array.from(files) }));
      } else {
        setForm((c) => ({ ...c, featuredImage: files[0] || null }));
      }
      return;
    }
    setForm((c) => ({ ...c, [name]: value }));
  };

  const handleDeleteGalleryImage = async (imageId) => {
    const result = await Swal.fire({
      ...swalOptions,
      icon: "warning",
      title: "Remove image?",
      text: "This image will be permanently removed from the blog gallery.",
      showCancelButton: true,
      confirmButtonText: "Yes, remove it",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
    });
    if (!result.isConfirmed) return;

    setDeletingImageId(imageId);
    try {
      await deleteBlogImage(imageId, getAuthToken());
      setBlog((prev) => ({
        ...prev,
        images: getBlogImages(prev).filter((img) => img.id !== imageId),
      }));
      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Media removed",
        text: "The media file has been removed from the blog gallery.",
      });
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not remove image",
        text: err.message || "Please try again.",
      });
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isBlogContentEmpty(form.content)) {
      await Swal.fire({
        ...swalOptions,
        icon: "warning",
        title: "Content is required",
        text: "Write some blog content before saving the post.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = getAuthToken();

      if (form.featuredImage) {
        setSubmitStep(GALLERY_WATERMARK_ENABLED ? "Applying watermark..." : "Preparing image...");
      }
      const featuredImage = form.featuredImage
        ? await addGalleryWatermark(form.featuredImage)
        : null;

      setSubmitStep("Saving...");
      await updateBlog(
        {
          id: blog.id,
          title: form.title,
          content: stripManagedImages(form.content),
          featuredImage,
          status: form.status,
          categoryId: Number(form.categoryId),
        },
        token
      );

      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Blog updated",
        text: "The blog post has been updated successfully.",
      });
      navigate("/blogs");
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not update blog",
        text: err.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  };

  if (loading) {
    return (
      <MasterLayout>
        <div className="eloquent-contact-state" style={{ minHeight: "60vh" }}>
          <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="34" />
          <strong>Loading blog...</strong>
          <span>Fetching blog data from the API.</span>
        </div>
      </MasterLayout>
    );
  }

  const blogImages = getBlogImages(blog);

  return (
    <MasterLayout>
      <div className="eloquent-blog-edit-header">
        <div className="eloquent-page-head" style={{ margin: 0 }}>
          <span>Eloquent Images / Blogs</span>
          <h2>Edit Blog</h2>
          <p>{blog?.title}</p>
        </div>
        <button
          className="eloquent-btn eloquent-btn-secondary"
          onClick={() => navigate("/blogs")}
          style={{ flexShrink: 0 }}
          type="button"
        >
          <Icon icon="solar:alt-arrow-left-linear" width="16" />
          Back to Blogs
        </button>
      </div>

      {/* ── Main blog fields ─────────────────────────────────── */}
      <form
        className="eloquent-panel eloquent-form"
        onSubmit={handleSubmit}
        ref={formRef}
        style={{ marginTop: "22px" }}
      >
        <div className="row gy-3">
          <div className="col-lg-6">
            <label>Title</label>
            <input
              name="title"
              onChange={handleChange}
              placeholder="Blog title"
              required
              value={form.title}
            />
          </div>
          <div className="col-lg-3">
            <label>Category</label>
            <select name="categoryId" onChange={handleChange} required value={form.categoryId}>
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-3">
            <label>Status</label>
            <select name="status" onChange={handleChange} value={form.status}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="col-12">
            <label>Featured Image</label>
            <input
              accept="image/*"
              name="featuredImage"
              onChange={handleChange}
              type="file"
            />
            {form.featuredImage ? (
              <div className="eloquent-blog-edit-preview is-selected" style={{ marginTop: "10px" }}>
                <small>New featured image selected</small>
                <SelectedFilePreview alt="new featured image" file={form.featuredImage} />
              </div>
            ) : (blog?.featuredImage || blog?.featured_image) ? (
              <div className="eloquent-blog-edit-preview" style={{ marginTop: "10px" }}>
                <small>Current featured image</small>
                <EloquentImage
                  alt={blog.title}
                  src={blog.featuredImage || blog.featured_image}
                />
              </div>
            ) : null}
          </div>

          <div className="col-12">
            <label>Content</label>
            <BlogContentEditor
              onChange={(content) => setForm((current) => ({ ...current, content }))}
              value={form.content}
            />
          </div>

          <div className="col-12" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="eloquent-btn" disabled={submitting} type="submit">
              {submitting ? submitStep || "Saving..." : "Save Changes"}
            </button>
            <button
              className="eloquent-btn eloquent-btn-secondary"
              disabled={submitting}
              onClick={() => navigate("/blogs")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* ── Gallery images management ─────────────────────────── */}
      <section className="eloquent-panel eloquent-contact-panel" style={{ marginTop: "22px" }}>
        <div className="eloquent-contact-toolbar">
          <div>
            <h3>Blog Content Gallery</h3>
            <p>
              {blogImages.length > 0
                ? `${blogImages.length} media file${blogImages.length !== 1 ? "s" : ""} shown below the blog content`
                : "No content gallery media yet"}
            </p>
          </div>
        </div>

        {/* Existing images */}
        {blogImages.length > 0 && (
          <div className="eloquent-blog-gallery-grid">
            {blogImages.map((image) => {
              const isDeleting = deletingImageId === image.id;
              return (
                <div
                  className={`eloquent-blog-gallery-item${isDeleting ? " is-deleting" : ""}`}
                  key={image.id || getImageUrl(image)}
                >
                  <div className="eloquent-blog-gallery-thumb">
                    <EloquentMedia
                      alt={`Blog gallery media ${image.id}`}
                      controls
                      src={getImageUrl(image)}
                    />
                    <span className="eloquent-blog-gallery-type">
                      {/\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i.test(getImageUrl(image))
                        ? "Video"
                        : "Image"}
                    </span>
                    {isDeleting && (
                      <div className="eloquent-blog-gallery-overlay">
                        <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="20" />
                      </div>
                    )}
                  </div>
                  <button
                    aria-label="Remove image"
                    className="eloquent-blog-gallery-delete"
                    disabled={isDeleting}
                    onClick={() => handleDeleteGalleryImage(image.id)}
                    title="Remove this image"
                    type="button"
                  >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width="13" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new gallery images */}
        <div className="eloquent-blog-gallery-add">
          <label className="eloquent-blog-gallery-add-label">
            <Icon icon="solar:gallery-add-linear" width="20" />
            <span>
              <strong>
                {form.newGalleryImages.length > 0
                  ? `${form.newGalleryImages.length} media file${form.newGalleryImages.length !== 1 ? "s" : ""} selected`
                  : "Add Images "}
              </strong>
              <small>These will appear below the blog content on the website</small>
            </span>
            <input
              accept="image/*,video/*"
              multiple
              name="newGalleryImages"
              onChange={handleChange}
              type="file"
              style={{ display: "none" }}
            />
            <em>Browse</em>
          </label>

          {form.newGalleryImages.length > 0 && (
            <>
              <div className="eloquent-blog-gallery-preview-row">
                {form.newGalleryImages.map((file, index) => (
                  <div className="eloquent-blog-gallery-preview-item" key={`${file.name}-${file.lastModified}`}>
                    <SelectedFilePreview alt={file.name} file={file} />
                    <button
                      aria-label={`Remove ${file.name} from selection`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          newGalleryImages: current.newGalleryImages.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      title="Remove from selection"
                      type="button"
                    >
                      <Icon icon="solar:close-circle-bold" width="16" />
                    </button>
                    <small title={file.name}>{file.name}</small>
                  </div>
                ))}
              </div>
              <button
                className="eloquent-btn"
                disabled={uploadingGallery}
                onClick={async () => {
                  setUploadingGallery(true);
                  try {
                    const count = form.newGalleryImages.length;
                    setGalleryStep(
                      GALLERY_WATERMARK_ENABLED ? "Applying watermarks..." : "Preparing images..."
                    );
                    const galleryFiles = await addWatermarkToFiles(form.newGalleryImages);
                    setGalleryStep("Uploading...");
                    const result = await addBlogImages(blog.id, galleryFiles, getAuthToken());
                    const uploaded = Array.isArray(result.data) ? result.data : [];
                    if (uploaded.length > 0) {
                      setBlog((current) => ({
                        ...current,
                        images: [
                          ...getBlogImages(current).filter(
                            (item) => !uploaded.some((newItem) => newItem.id === item.id)
                          ),
                          ...uploaded,
                        ],
                      }));
                    } else {
                      const allBlogs = await fetchBlogs();
                      const refreshed = allBlogs.find((item) => String(item.id) === String(id));
                      if (refreshed) setBlog(refreshed);
                    }
                    setForm((c) => ({ ...c, newGalleryImages: [] }));
                    await Swal.fire({
                      ...swalOptions,
                      icon: "success",
                      title: "Media added",
                      text: `${count} media file${count !== 1 ? "s" : ""} added below the blog content.`,
                    });
                  } catch (err) {
                    await Swal.fire({
                      ...swalOptions,
                      icon: "error",
                      title: "Upload failed",
                      text: err.message || "Could not add media. Please try again.",
                    });
                  } finally {
                    setUploadingGallery(false);
                    setGalleryStep("");
                  }
                }}
                type="button"
              >
                <Icon icon="solar:upload-minimalistic-linear" width="16" />
                {uploadingGallery
                  ? galleryStep || "Uploading..."
                  : `Upload ${form.newGalleryImages.length} Media File${form.newGalleryImages.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      </section>
    </MasterLayout>
  );
};

export default EloquentBlogEditPage;
