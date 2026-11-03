import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react/dist/iconify.js";
import Swal from "sweetalert2";
import MasterLayout from "../otherImages/MasterLayout";
import BlogContentEditor, { isBlogContentEmpty } from "../components/BlogContentEditor";
import EloquentMedia from "../components/EloquentMedia";
import { addBlogImages, createBlog, fetchCategories, getAuthToken } from "../api/eloquentApi";
import {
  addGalleryWatermark,
  addWatermarkToFiles,
  GALLERY_WATERMARK_ENABLED,
} from "../utils/watermarkImage";

const emptyForm = {
  title: "",
  categoryId: "",
  featuredImage: null,
  content: "",
  s3Images: [],
  status: "ACTIVE",
};

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

const EloquentBlogCreatePage = () => {
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");

  useEffect(() => {
    fetchCategories()
      .then((data) => setCategories([...data].reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (event) => {
    const { name, type, value, files } = event.target;
    if (type === "file") {
      if (name === "s3Images") {
        setForm((c) => ({ ...c, s3Images: Array.from(files) }));
      } else {
        setForm((c) => ({ ...c, featuredImage: files[0] || null }));
      }
      return;
    }
    setForm((c) => ({ ...c, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isBlogContentEmpty(form.content)) {
      await Swal.fire({
        ...swalOptions,
        icon: "warning",
        title: "Content is required",
        text: "Write some blog content before creating the post.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = getAuthToken();

      if (form.featuredImage || form.s3Images.length > 0) {
        setSubmitStep(GALLERY_WATERMARK_ENABLED ? "Applying watermarks..." : "Preparing images...");
      }
      const featuredImage = form.featuredImage
        ? await addGalleryWatermark(form.featuredImage)
        : null;
      const galleryFiles = await addWatermarkToFiles(form.s3Images);

      setSubmitStep("Creating blog...");
      const result = await createBlog(
        {
          title: form.title,
          content: stripManagedImages(form.content),
          featuredImage,
          status: form.status,
          categoryId: Number(form.categoryId),
        },
        token
      );
      const createdBlogId =
        result.data?.id || result.blog?.id || result.data?.blog?.id || result.id;

      if (galleryFiles.length > 0) {
        if (!createdBlogId) {
          throw new Error("Blog was created, but its ID was not returned for gallery upload.");
        }
        setSubmitStep("Uploading images...");
        await addBlogImages(createdBlogId, galleryFiles, token);
      }
      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Blog created",
        text: "The new blog post is now available.",
      });
      navigate("/blogs");
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not create blog",
        text: err.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  };

  return (
    <MasterLayout>
      <div className="eloquent-blog-edit-header">
        <div className="eloquent-page-head" style={{ margin: 0 }}>
          <span>Eloquent Images / Blogs</span>
          <h2>Create Blog</h2>
          <p>Fill in the details to publish a new blog post.</p>
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
              placeholder="Add Title"
              required
              value={form.title}
            />
          </div>
          <div className="col-lg-3">
            <label>Category</label>
            <select
              disabled={loading}
              name="categoryId"
              onChange={handleChange}
              required
              value={form.categoryId}
            >
              <option value="">
                {loading ? "Loading categories..." : "Select category"}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
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

          <div className="col-md-6">
            <label>Featured Image</label>
            <input
              accept="image/*"
              name="featuredImage"
              onChange={handleChange}
              type="file"
            />
            {form.featuredImage && (
              <div className="eloquent-blog-edit-preview is-selected">
                <small>Selected featured image</small>
                <SelectedFilePreview
                  alt={form.title || "featured image"}
                  file={form.featuredImage}
                />
              </div>
            )}
          </div>

          <div className="col-md-6">
            <label>Blog Gallery Images</label>
            <input
              accept="image/*,video/*"
              multiple
              name="s3Images"
              onChange={handleChange}
              type="file"
            />
            <small className="eloquent-field-help">
              {form.s3Images.length > 0
                ? `${form.s3Images.length} media file${
                    form.s3Images.length > 1 ? "s" : ""
                  } selected: ${form.s3Images.map((f) => f.name).join(", ")}`
                : "Images will appear below the blog content on the website."}
            </small>
            {form.s3Images.length > 0 && (
              <div className="eloquent-blog-edit-preview is-selected">
                <small>Selected content gallery media</small>
                <div className="eloquent-blog-gallery-preview-row">
                  {form.s3Images.map((file, index) => (
                    <div className="eloquent-blog-gallery-preview-item" key={`${file.name}-${file.lastModified}`}>
                      <SelectedFilePreview alt={file.name} file={file} />
                      <button
                        aria-label={`Remove ${file.name} from selection`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            s3Images: current.s3Images.filter((_, itemIndex) => itemIndex !== index),
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
              </div>
            )}
          </div>

          <div className="col-12">
            <label>Content</label>
            <BlogContentEditor
              onChange={(content) => setForm((current) => ({ ...current, content }))}
              value={form.content}
            />
          </div>

          <div
            className="col-12"
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
          >
            <button className="eloquent-btn" disabled={submitting} type="submit">
              {submitting ? submitStep || "Creating..." : "Create Blog"}
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
    </MasterLayout>
  );
};

export default EloquentBlogCreatePage;
