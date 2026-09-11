import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  addHomeCategoryImage,
  createHomeCategory,
  deleteHomeCategory,
  deleteHomeCategoryImage,
  fetchAllGalleryImages,
  fetchCategories,
  fetchHomeCategories,
  fetchHomeCategory,
  getAuthSession,
  updateHomeCategory,
} from "../api/eloquentApi";
import EloquentImage from "../components/EloquentImage";
import MasterLayout from "../otherImages/MasterLayout";

const swalOptions = {
  background: "#101722",
  color: "#f5f8fa",
  confirmButtonColor: "#3b586e",
  customClass: { popup: "eloquent-swal-popup" },
};

function getImageName(image = {}) {
  return image.title || image.originalName || image.fileName || image.filename || "Untitled image";
}

function normalizeSection(section = {}) {
  return {
    ...section,
    categoryId: section.category_id || section.categoryId || section.category?.id || "",
    coverImageId: section.image_id || section.imageId || section.image?.id || "",
    images: Array.isArray(section.images) ? section.images : [],
  };
}

const HOME_CATEGORY_DEFAULT_DESCRIPTIONS = {
  birds: '"The bird sings not because it has an answer, but because it has a song" - Maya Angelou',
  mammals: '"Art has an ability to connect us beyond the limitations of language" - Rick Rubin',
  "insects-and-spiders": '"The world is a stage, and the insects are the actors" - David Attenborough',
  "insects-spiders": '"The world is a stage, and the insects are the actors" - David Attenborough',
  "reptiles-and-amphibians": '"The serpent, that crafty, ancient being, knows more than we do" - Carl Jung',
  "reptiles-amphibians": '"The serpent, that crafty, ancient being, knows more than we do" - Carl Jung',
  flora: '"In every leaf, there\'s a story waiting to be told" Laura Jaworski.',
  landscapes: '"In every walk with nature one receives far more than he seeks" - John Muir',
  miscellaneous: '"Photography takes an instant out of time, altering life by holding it still" - Dorothea Lange',
};

function getCategorySlug(category = {}) {
  return String(category.slug || category.name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDefaultDescription(category = {}) {
  return HOME_CATEGORY_DEFAULT_DESCRIPTIONS[getCategorySlug(category)] || "";
}

function findSectionByCategoryId(sections, categoryId) {
  return sections.find((section) => String(section.categoryId) === String(categoryId));
}

const EloquentHomeCategoriesPage = () => {
  const navigate = useNavigate();
  const { categoryId: routeCategoryId } = useParams();
  const token = getAuthSession()?.token;
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageId, setCoverImageId] = useState("");
  const [libraryImages, setLibraryImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingImageId, setWorkingImageId] = useState(null);
  const [error, setError] = useState("");

  const assignedImageIds = useMemo(
    () => new Set((selectedSection?.images || []).map((item) => Number(item.image_id || item.image?.id))),
    [selectedSection]
  );

  const selectedCategoryId = routeCategoryId || "";
  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );
  const selectedCategorySection = useMemo(
    () => findSectionByCategoryId(sections, selectedCategoryId),
    [sections, selectedCategoryId]
  );
  const selectedCategoryName =
    selectedCategory?.name || categories.find((category) => String(category.id) === String(categoryId))?.name || "";

  const loadSections = useCallback(async () => {
    const data = await fetchHomeCategories(token);
    const normalized = data.map(normalizeSection);
    setSections(normalized);
    return normalized;
  }, [token]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryData, sectionData] = await Promise.all([fetchCategories(), fetchHomeCategories(token)]);
      setCategories(categoryData);
      const normalized = sectionData.map(normalizeSection);
      setSections(normalized);
    } catch (err) {
      setError(err.message || "Unable to load home categories.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setSelectedSection(null);
      setCategoryId("");
      setDescription("");
      setCoverImageId("");
      setLibraryImages([]);
      return;
    }

    const linkedSection = selectedCategorySection;
    setCategoryId(String(selectedCategoryId));

    if (!linkedSection?.id) {
      setSelectedSection(null);
      setDescription(getDefaultDescription(selectedCategory));
      setCoverImageId("");
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setError("");
      try {
        const detail = normalizeSection(await fetchHomeCategory(linkedSection.id, token));
        if (cancelled) return;
        setSelectedSection(detail);
        setCategoryId(String(detail.categoryId || ""));
        setDescription(detail.description || getDefaultDescription(detail.category || selectedCategory));
        setCoverImageId(String(detail.coverImageId || ""));
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load category details.");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, selectedCategoryId, selectedCategorySection, token]);

  useEffect(() => {
    if (!categoryId) {
      setLibraryImages([]);
      return;
    }

    let cancelled = false;
    async function loadImages() {
      try {
        const result = await fetchAllGalleryImages({ categoryId, limit: 1000 });
        if (!cancelled) setLibraryImages(result.images || []);
      } catch {
        if (!cancelled) setLibraryImages([]);
      }
    }

    loadImages();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const handleCategoryChange = (nextCategoryId) => {
    const nextCategory = categories.find((category) => String(category.id) === String(nextCategoryId));
    setCategoryId(nextCategoryId);
    if (!findSectionByCategoryId(sections, nextCategoryId)) {
      setDescription(getDefaultDescription(nextCategory));
      setCoverImageId("");
    }
    if (nextCategoryId) navigate(`/home-categories/${nextCategoryId}`);
  };

  const handleSaveSection = async () => {
    if (!categoryId) {
      await Swal.fire({ ...swalOptions, icon: "warning", title: "Select a category" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category_id: Number(categoryId),
        description: description.trim(),
      };
      if (coverImageId) payload.image_id = Number(coverImageId);

      const result = selectedSection
        ? await updateHomeCategory(selectedSection.id, payload, token)
        : await createHomeCategory(payload, token);
      const saved = normalizeSection(result.data || result);
      await loadSections();
      navigate(`/home-categories/${saved.categoryId || categoryId}`, { replace: true });
      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: selectedSection ? "Home category updated" : "Home category created",
        text: "Homepage category content has been saved.",
      });
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not save category",
        text: err.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!selectedSection) return;
    await deleteSectionRecord(selectedSection, selectedCategory);
  };

  const deleteSectionRecord = async (section, category = null) => {
    if (!section) return;
    const confirmation = await Swal.fire({
      ...swalOptions,
      cancelButtonColor: "#273441",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b84f57",
      confirmButtonText: "Delete",
      icon: "warning",
      reverseButtons: true,
      showCancelButton: true,
      text: `${section.category?.name || category?.name || selectedCategoryName} will be removed from homepage categories.`,
      title: "Delete home category?",
    });

    if (!confirmation.isConfirmed) return;
    setSaving(true);
    try {
      await deleteHomeCategory(section.id, token);
      await loadSections();
      if (String(section.categoryId) === String(selectedCategoryId)) {
        setSelectedSection(null);
        setDescription(getDefaultDescription(selectedCategory));
        setCoverImageId("");
      }
      await Swal.fire({ ...swalOptions, icon: "success", title: "Home category deleted" });
    } catch (err) {
      await Swal.fire({ ...swalOptions, icon: "error", title: "Could not delete category", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = async (image) => {
    if (!selectedSection) {
      await Swal.fire({ ...swalOptions, icon: "info", title: "Save the category first" });
      return;
    }
    if ((selectedSection.images || []).length >= 8) {
      await Swal.fire({ ...swalOptions, icon: "warning", title: "Maximum 8 images allowed" });
      return;
    }
    setWorkingImageId(image.id);
    try {
      await addHomeCategoryImage({ categoryId: selectedSection.id, imageId: image.id }, token);
      const detail = normalizeSection(await fetchHomeCategory(selectedSection.id, token));
      setSelectedSection(detail);
      await Swal.fire({ ...swalOptions, icon: "success", title: "Image added" });
    } catch (err) {
      await Swal.fire({ ...swalOptions, icon: "error", title: "Could not add image", text: err.message });
    } finally {
      setWorkingImageId(null);
    }
  };

  const handleRemoveImage = async (item) => {
    setWorkingImageId(item.id);
    try {
      await deleteHomeCategoryImage(item.id, token);
      const detail = normalizeSection(await fetchHomeCategory(selectedSection.id, token));
      setSelectedSection(detail);
    } catch (err) {
      await Swal.fire({ ...swalOptions, icon: "error", title: "Could not remove image", text: err.message });
    } finally {
      setWorkingImageId(null);
    }
  };

  const selectedCoverImage = useMemo(() => {
    if (coverImageId) {
      const libraryImage = libraryImages.find((image) => String(image.id) === String(coverImageId));
      if (libraryImage) return libraryImage;
    }

    return selectedSection?.image || selectedSection?.images?.[0]?.image || null;
  }, [coverImageId, libraryImages, selectedSection]);

  return (
    <MasterLayout>
      <div className="eloquent-contact-heading">
        <div className="eloquent-page-head" style={{ margin: 0 }}>
          <span>Eloquent Images</span>
          <h2>{selectedCategory ? selectedCategory.name : "Home Categories"}</h2>
          <p>
            {selectedCategory
              ? "Manage this homepage category cover, description, and preview images."
              : "Choose a category to manage its homepage section."}
          </p>
        </div>
        <div className="eloquent-home-heading-actions">
          {selectedCategory && (
            <button className="eloquent-btn eloquent-btn-secondary" onClick={() => navigate("/home-categories")} type="button">
              <Icon icon="solar:alt-arrow-left-linear" width="18" />
              Back
            </button>
          )}
          <button className="eloquent-btn eloquent-refresh-btn" onClick={loadPage} type="button">
            <Icon icon="solar:refresh-linear" width="18" />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="eloquent-alert error mt-4">{error}</div>}

      <section className="eloquent-panel eloquent-home-categories mt-4">
        {loading ? (
          <div className="eloquent-gallery-state">
            <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="28" />
            <strong>Loading home categories...</strong>
          </div>
        ) : !selectedCategoryId ? (
          <div className="eloquent-home-category-cards">
              {categories.map((category) => {
                const section = findSectionByCategoryId(sections, category.id);
                const coverImage = section?.image || section?.images?.[0]?.image;
                return (
                  <button
                    className="eloquent-home-category-card"
                    key={category.id}
                    onClick={() => navigate(`/home-categories/${category.id}`)}
                    type="button"
                  >
                    <div>
                      {coverImage ? (
                        <EloquentImage alt={getImageName(coverImage)} src={coverImage.imageUrl} />
                      ) : (
                        <span className="eloquent-home-category-empty-cover">
                          <Icon icon="solar:gallery-minimalistic-linear" width="30" />
                        </span>
                      )}
                    </div>
                    <strong>{category.name || "Untitled"}</strong>
                    <span className={`eloquent-home-category-status${section ? "" : " is-unconfigured"}`}>
                      {section ? `${(section.images || []).length} / 8 images` : "Not configured"}
                    </span>
                    <div className="eloquent-home-category-card-actions">
                      <small className={section ? "is-open-details" : "is-create-details"}>
                        {section ? "Open details" : "Create details"}
                      </small>
                      {section && (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteSectionRecord(section, category);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            deleteSectionRecord(section, category);
                          }}
                          role="button"
                          tabIndex="0"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="15" />
                          Delete
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {categories.length === 0 && <p>No categories found.</p>}
          </div>
        ) : (
          <div className="eloquent-home-category-detail">
              {loadingDetail ? (
                <div className="eloquent-gallery-state">
                  <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="28" />
                  <strong>Loading selected category...</strong>
                </div>
              ) : (
                <>
                  <div className="eloquent-home-category-form">
                    <label>
                      <span>Category</span>
                      <select value={categoryId} onChange={(event) => handleCategoryChange(event.target.value)}>
                        <option value="">Select category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Cover Photo</span>
                      <select value={coverImageId} onChange={(event) => setCoverImageId(event.target.value)}>
                        <option value="">Use first selected image</option>
                        {libraryImages.map((image) => (
                          <option key={image.id} value={image.id}>
                            {getImageName(image)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="eloquent-home-cover-preview">
                      {selectedCoverImage ? (
                        <>
                          <EloquentImage alt={getImageName(selectedCoverImage)} src={selectedCoverImage.imageUrl} />
                          <span>{getImageName(selectedCoverImage)}</span>
                        </>
                      ) : (
                        <span>No cover selected</span>
                      )}
                    </div>

                    <label className="eloquent-home-category-description">
                      <span>Description</span>
                      <textarea
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Add homepage category description"
                        rows={5}
                        value={description}
                      />
                    </label>

                    <div className="eloquent-home-category-actions">
                      {selectedSection && (
                        <button
                          className="eloquent-btn eloquent-btn-danger"
                          disabled={saving}
                          onClick={handleDeleteSection}
                          type="button"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="16" />
                          Delete
                        </button>
                      )}
                      <button className="eloquent-btn" disabled={saving} onClick={handleSaveSection} type="button">
                        <Icon
                          className={saving ? "eloquent-contact-spinner" : ""}
                          icon={saving ? "solar:refresh-linear" : "solar:diskette-linear"}
                          width="16"
                        />
                        {saving ? "Saving..." : "Save Section"}
                      </button>
                    </div>
                  </div>

                  {selectedSection && (
                    <>
                      <div className="eloquent-home-selected-images">
                        <div className="eloquent-panel-heading">
                          <div>
                            <span className="eloquent-section-icon">
                              <Icon icon="solar:gallery-wide-linear" width="22" />
                            </span>
                            <div>
                              <h3>Homepage Preview Images</h3>
                              <p>{selectedSection.images.length} of 8 selected</p>
                            </div>
                          </div>
                        </div>
                        <div className="eloquent-home-image-grid">
                          {selectedSection.images.map((item) => (
                            <article key={item.id}>
                              <EloquentImage alt={getImageName(item.image)} src={item.image?.imageUrl} />
                              <strong>{getImageName(item.image)}</strong>
                              <button disabled={workingImageId === item.id} onClick={() => handleRemoveImage(item)} type="button">
                                <Icon
                                  className={workingImageId === item.id ? "eloquent-contact-spinner" : ""}
                                  icon={workingImageId === item.id ? "solar:refresh-linear" : "solar:trash-bin-trash-linear"}
                                  width="16"
                                />
                                Remove
                              </button>
                            </article>
                          ))}
                          {selectedSection.images.length === 0 && <p>No preview images selected.</p>}
                        </div>
                      </div>

                      <div className="eloquent-home-library">
                        <div className="eloquent-panel-heading">
                          <div>
                            <span className="eloquent-section-icon">
                              <Icon icon="solar:gallery-add-linear" width="22" />
                            </span>
                            <div>
                              <h3>{selectedCategoryName || "Category"} Images</h3>
                              <p>Add up to 8 images for this homepage section.</p>
                            </div>
                          </div>
                        </div>
                        <div className="eloquent-home-image-grid">
                          {libraryImages.map((image) => {
                            const isAssigned = assignedImageIds.has(Number(image.id));
                            return (
                              <article key={image.id}>
                                <EloquentImage alt={getImageName(image)} src={image.imageUrl} />
                                <strong>{getImageName(image)}</strong>
                                <button
                                  disabled={isAssigned || workingImageId === image.id || selectedSection.images.length >= 8}
                                  onClick={() => handleAddImage(image)}
                                  type="button"
                                >
                                  <Icon
                                    className={workingImageId === image.id ? "eloquent-contact-spinner" : ""}
                                    icon={isAssigned ? "solar:check-circle-bold" : workingImageId === image.id ? "solar:refresh-linear" : "solar:add-circle-linear"}
                                    width="16"
                                  />
                                  {isAssigned ? "Added" : "Add"}
                                </button>
                              </article>
                            );
                          })}
                          {libraryImages.length === 0 && <p>No images found for this category.</p>}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
          </div>
        )}
      </section>
    </MasterLayout>
  );
};

export default EloquentHomeCategoriesPage;
