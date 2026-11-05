import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  deleteImage,
  fetchAllGalleryImages,
  fetchCategories,
  fetchGalleryImages,
  fetchWhatsNewGalleryImages,
  getAuthSession,
  syncCategoryAlphabeticalSortOrder,
  updateGalleryImageCategories,
  updateGalleryImageTitle,
  updateGalleryImageIsNew,
  updateGalleryImageNewTitle,
  updateGalleryImageSortOrder,
} from "../api/eloquentApi";
import EloquentImage from "../components/EloquentImage";
import MasterLayout from "../otherImages/MasterLayout";

const swalOptions = {
  background: "#101722",
  color: "#f5f8fa",
  confirmButtonColor: "#3b586e",
  customClass: { popup: "eloquent-swal-popup" },
};

const GALLERY_PAGE_SIZE = 15;
const GALLERY_LIST_PAGE_SIZE = 1000;

function getSortOrderDraftKey(imageId, categoryId) {
  return `${categoryId || "all"}:${imageId}`;
}

function getImageName(image) {
  const name = image.title || image.originalName || image.fileName || image.filename;
  if (name?.trim()) return name.trim();
  return "Original name unavailable";
}

function getImageCategory(image, categoryId) {
  if (!categoryId) return null;
  return (image.categories || []).find((cat) => String(cat.id || cat.categoryId) === String(categoryId));
}

function getCategoryId(category) {
  const id = Number(category?.id ?? category?.categoryId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function deduplicateCategories(categories = []) {
  const seen = new Set();
  return (categories || []).filter((cat) => {
    const key = String(cat?.id ?? cat?.categoryId ?? cat?.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getImageCategoryNames(image) {
  const uniqueCats = deduplicateCategories(image?.categories);
  return uniqueCats.map((cat) => cat.name || cat.category?.name).filter(Boolean).join(", ");
}

function getImageCategoryIds(image) {
  return [
    ...new Set(
      deduplicateCategories(image?.categories)
        .map(getCategoryId)
        .filter(Boolean)
        .map(String)
    ),
  ];
}

function getCategoryById(categories, categoryId) {
  if (!categoryId) return null;
  return categories.find((category) => String(category.id) === String(categoryId)) || null;
}

function isBirdsCategory(category = null) {
  const value = String(category?.slug || category?.name || category?.label || "").toLowerCase();
  return value === "birds";
}

function getBirdCategoryIds(categories = [], categoryIds = []) {
  const selectedIds = new Set(categoryIds.map(String));
  return categories
    .filter((category) => isBirdsCategory(category) && selectedIds.has(String(category.id)))
    .map((category) => String(category.id));
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function limitMetaTotal(meta = {}, maxTotalItems) {
  const safeMaxTotal = Math.max(0, Number(maxTotalItems) || 0);
  const serverTotal = toFiniteNumber(meta.totalItems);
  const totalItems = serverTotal === null ? safeMaxTotal : Math.min(serverTotal, safeMaxTotal);
  const nextMeta = { ...meta, totalItems };
  const itemsPerPage = toFiniteNumber(nextMeta.itemsPerPage);

  if (itemsPerPage && itemsPerPage > 0) {
    nextMeta.totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  }

  const totalPages = toFiniteNumber(nextMeta.totalPages);
  const currentPage = toFiniteNumber(nextMeta.currentPage);
  if (totalPages && currentPage) {
    nextMeta.currentPage = Math.min(currentPage, totalPages);
  }

  return nextMeta;
}

function isMarkedNew(image) {
  return (
    image.isNew === true ||
    image.is_new === true ||
    String(image.isNew).toLowerCase() === "true" ||
    String(image.is_new).toLowerCase() === "true"
  );
}

function getWhatsNewFact(image = {}) {
  return (
    image.whatsNewFact ||
    image.whats_new_fact ||
    image.interestingFact ||
    image.interesting_fact ||
    image.titles ||
    image.newTitleUpdate ||
    image.newTitleUpdatw ||
    image.new_title_update ||
    image.newTitle ||
    image.new_title ||
    image.isNewTitle ||
    image.is_new_title ||
    ""
  ).trim();
}

function applyWhatsNewState(images, whatsNewIds, whatsNewById = new Map()) {
  return images.map((image) => {
    const whatsNewImage = whatsNewById.get(String(image.id));
    const isNew = Boolean(whatsNewImage) || whatsNewIds.has(String(image.id)) || isMarkedNew(image);
    return {
      ...image,
      isNew,
      is_new: isNew,
      whatsNewFact: whatsNewImage ? getWhatsNewFact(whatsNewImage) : getWhatsNewFact(image),
    };
  });
}

function sortByImageName(images = []) {
  return [...images].sort((first, second) =>
    getImageName(first).localeCompare(getImageName(second), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function sortGalleryImages(images = [], categoryId = "", category = null) {
  if (isBirdsCategory(category)) {
    return sortByImageName(images);
  }

  const hasCategorySortOrder =
    categoryId &&
    images.some((image) => {
      const sortOrder = Number(getImageCategory(image, categoryId)?.sortOrder);
      return Number.isFinite(sortOrder) && sortOrder > 0;
    });

  if (categoryId && !hasCategorySortOrder) {
    return [...images];
  }

  return [...images].sort((first, second) => {
    const firstOrder = Number(getImageCategory(first, categoryId)?.sortOrder);
    const secondOrder = Number(getImageCategory(second, categoryId)?.sortOrder);
    const hasFirstOrder = Number.isFinite(firstOrder) && firstOrder > 0;
    const hasSecondOrder = Number.isFinite(secondOrder) && secondOrder > 0;

    if (hasFirstOrder && hasSecondOrder && firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
    if (hasFirstOrder !== hasSecondOrder) return hasFirstOrder ? -1 : 1;

    return sortByImageName([first, second])[0] === first ? -1 : 1;
  });
}

function withCategorySortOrder(image, categoryId, sortOrder) {
  const categoryExists = (image.categories || []).some(
    (category) => String(category.id ?? category.categoryId) === String(categoryId)
  );
  const categories = categoryExists
    ? (image.categories || []).map((category) =>
        String(category.id ?? category.categoryId) === String(categoryId)
          ? { ...category, sortOrder }
          : category
      )
    : [
        ...(image.categories || []),
        {
          id: Number(categoryId),
          categoryId: Number(categoryId),
          sortOrder,
        },
      ];

  return { ...image, categories };
}

function getSortOrderPayloadCategories(image, categoryId, sortOrder) {
  const activeCategoryId = Number(categoryId);
  if (!Number.isInteger(activeCategoryId) || activeCategoryId <= 0) {
    return [];
  }
  // Send ONLY the active category so that the sort order of this category
  // remains completely independent and never modifies or resets other categories.
  return [{ categoryId: activeCategoryId, sortOrder: Number(sortOrder) }];
}

function mergeImageSortOrderFromResponse(image, responseImage, categoryId) {
  const responseCategory = (responseImage?.categories || []).find(
    (category) => String(category.id ?? category.categoryId) === String(categoryId)
  );
  const responseSortOrder = Number(responseCategory?.sortOrder);

  return Number.isInteger(responseSortOrder) && responseSortOrder > 0
    ? withCategorySortOrder({ ...responseImage, categories: image.categories }, categoryId, responseSortOrder)
    : image;
}

const EloquentGalleryPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [loadingImages, setLoadingImages] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitleId, setSavingTitleId] = useState(null);
  const [editingCategoriesId, setEditingCategoriesId] = useState(null);
  const [editingCategoryIds, setEditingCategoryIds] = useState([]);
  const [savingCategoriesId, setSavingCategoriesId] = useState(null);
  const [whatsNewIds, setWhatsNewIds] = useState(() => new Set());
  const [viewMode, setViewMode] = useState("grid");
  const [sortOrderDrafts, setSortOrderDrafts] = useState({});
  const [savingSortOrderId, setSavingSortOrderId] = useState(null);
  const [whatsNewFactDrafts, setWhatsNewFactDrafts] = useState({});
  const [savingWhatsNewFactId, setSavingWhatsNewFactId] = useState(null);
  const [expandedFactIds, setExpandedFactIds] = useState(() => new Set());

  const token = getAuthSession()?.token;

  const loadCategories = async () => {
    const data = await fetchCategories();
    setCategories([...data].reverse());
  };

  const loadImages = useCallback(async (categoryId = activeCategory, pageNumber = page, options = {}) => {
    setLoadingImages(true);
    try {
      const isListView = viewMode === "list";
      const selectedCategory = getCategoryById(categories, categoryId);
      const shouldClientPageBirds = !isListView && isBirdsCategory(selectedCategory);
      const [data, whatsNewImages] = await Promise.all([
        isListView || shouldClientPageBirds
          ? fetchAllGalleryImages({ categoryId, limit: GALLERY_LIST_PAGE_SIZE, sortBy: "title" })
          : fetchGalleryImages({ categoryId, page: pageNumber, limit: GALLERY_PAGE_SIZE }),
        fetchWhatsNewGalleryImages(),
      ]);
      const nextWhatsNewIds = new Set(whatsNewImages.map((image) => String(image.id)));
      const nextWhatsNewById = new Map(whatsNewImages.map((image) => [String(image.id), image]));
      setWhatsNewIds(nextWhatsNewIds);

      const sanitizedImages = (data.images || []).map((img) => ({
        ...img,
        categories: deduplicateCategories(img.categories),
      }));

      const allPageImages = options.deletedImageId
        ? sanitizedImages.filter((image) => String(image.id) !== String(options.deletedImageId))
        : sanitizedImages;
      const pageImages = shouldClientPageBirds
        ? sortGalleryImages(allPageImages, categoryId, selectedCategory).slice(
            (Math.max(1, Number(pageNumber) || 1) - 1) * GALLERY_PAGE_SIZE,
            Math.max(1, Number(pageNumber) || 1) * GALLERY_PAGE_SIZE
          )
        : allPageImages;
      const nextImages = applyWhatsNewState(
        sortGalleryImages(pageImages, categoryId, selectedCategory),
        nextWhatsNewIds,
        nextWhatsNewById
      );
      const nextMeta = shouldClientPageBirds
        ? {
              ...data.meta,
              currentPage: pageNumber,
              itemsPerPage: GALLERY_PAGE_SIZE,
              totalItems: allPageImages.length,
              totalPages: Math.max(1, Math.ceil(allPageImages.length / GALLERY_PAGE_SIZE)),
            }
        : options.maxTotalItems === undefined
          ? data.meta
          : limitMetaTotal(data.meta, options.maxTotalItems);
      setImages(nextImages);
      setSortOrderDrafts((current) => {
        const next = { ...current };
        const orderOffset = isListView ? 0 : (Math.max(1, Number(pageNumber) || 1) - 1) * GALLERY_PAGE_SIZE;
        nextImages.forEach((image, index) => {
          const categoryOrder = getImageCategory(image, categoryId)?.sortOrder;
          next[getSortOrderDraftKey(image.id, categoryId)] = String(categoryOrder || orderOffset + index + 1);
        });
        return next;
      });
      setWhatsNewFactDrafts((current) => {
        const next = { ...current };
        nextImages.forEach((image) => {
          next[image.id] = current[image.id] ?? getWhatsNewFact(image);
        });
        return next;
      });
      setMeta(nextMeta);
      return { images: nextImages, meta: nextMeta };
    } finally {
      setLoadingImages(false);
    }
  }, [activeCategory, categories, page, viewMode]);

  useEffect(() => {
    loadCategories().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadImages(activeCategory, page).catch((err) => setError(err.message));
  }, [activeCategory, loadImages, page]);

  const selectCategory = (categoryId) => {
    setActiveCategory(categoryId);
    setPage(1);
  };

  const selectViewMode = (mode) => {
    setViewMode(mode);
    setPage(1);
  };

  const handleDelete = async (target) => {
    const image =
      typeof target === "object" && target !== null
        ? target
        : images.find((img) => String(img.id) === String(target));
    const id = image?.id ?? target;
    if (!id) return;

    const imageCategories = image?.categories || [];
    const activeCatObj = getCategoryById(categories, activeCategory);
    const activeCatName = activeCatObj?.name || "this category";
    const isInCategoryView = Boolean(activeCategory);
    const isInMultipleCategories = imageCategories.length > 1;
    const isImageInActiveCategory =
      isInCategoryView &&
      imageCategories.some((c) => String(c.id ?? c.categoryId) === String(activeCategory));

    if (isInCategoryView && isInMultipleCategories && isImageInActiveCategory) {
      const otherCategoryList = imageCategories
        .filter((c) => String(c.id ?? c.categoryId) !== String(activeCategory))
        .map((c) => c.name || c.category?.name || "Other category");
      const otherCategories = otherCategoryList.join(", ");
      const otherChipsHtml = otherCategoryList
        .map((name) => `<span class="eloquent-modal-chip other">${name}</span>`)
        .join("");

      const result = await Swal.fire({
        ...swalOptions,
        title: "Remove or Delete?",
        customClass: {
          popup: "eloquent-swal-popup eloquent-swal-multi-delete-popup",
          actions: "eloquent-swal-multi-actions",
          confirmButton: "eloquent-btn-remove-cat",
          denyButton: "eloquent-btn-delete-perm",
          cancelButton: "eloquent-btn-cancel-modal",
        },
        html: `
          <div class="eloquent-delete-modal-body">
            <div class="eloquent-delete-item-banner">
              <span class="eloquent-delete-item-label">Image</span>
              <strong class="eloquent-delete-item-title">${getImageName(image)}</strong>
            </div>

            <div class="eloquent-delete-category-grid">
              <div class="eloquent-category-row">
                <span class="eloquent-category-meta-label">Selected category:</span>
                <span class="eloquent-modal-chip active">${activeCatName}</span>
              </div>
              <div class="eloquent-category-row">
                <span class="eloquent-category-meta-label">Also appears in:</span>
                <div class="eloquent-modal-chips-container">
                  ${otherChipsHtml}
                </div>
              </div>
            </div>

            <p class="eloquent-delete-instructions">
              This photo belongs to multiple categories. Choose an action:
            </p>
          </div>
        `,
        icon: "warning",
        iconColor: "#f59e0b",
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: `Remove from "${activeCatName}" only`,
        denyButtonText: "Delete Permanently (from all categories)",
        cancelButtonText: "Cancel",
        reverseButtons: false,
      });

      if (result.isConfirmed) {
        setDeletingId(id);
        try {
          const remainingCategoryIds = imageCategories
            .filter((c) => String(c.id ?? c.categoryId) !== String(activeCategory))
            .map((c) => String(c.id ?? c.categoryId));

          await updateGalleryImageCategories(id, remainingCategoryIds, token);
          setImages((current) => current.filter((img) => String(img.id) !== String(id)));
          const currentTotal = toFiniteNumber(meta.totalItems);
          const maxTotalItemsAfterDelete = Math.max(0, (currentTotal ?? images.length) - 1);
          setMeta((current) => limitMetaTotal(current, maxTotalItemsAfterDelete));
          await loadImages(activeCategory, page, {
            deletedImageId: id,
            maxTotalItems: maxTotalItemsAfterDelete,
          });
          await Swal.fire({
            ...swalOptions,
            icon: "success",
            title: "Removed from Category",
            text: `The image was removed from "${activeCatName}". It is still available in: ${otherCategories}.`,
          });
        } catch (err) {
          await Swal.fire({
            ...swalOptions,
            icon: "error",
            title: "Could not remove image",
            text: err.message || "Please try again.",
          });
        } finally {
          setDeletingId(null);
        }
        return;
      }

      if (result.isDenied) {
        setDeletingId(id);
        try {
          const currentTotal = toFiniteNumber(meta.totalItems);
          const maxTotalItemsAfterDelete = Math.max(0, (currentTotal ?? images.length) - 1);

          await deleteImage(id, token);
          setImages((current) => current.filter((img) => String(img.id) !== String(id)));
          setMeta((current) => limitMetaTotal(current, maxTotalItemsAfterDelete));
          await loadImages(activeCategory, page, {
            deletedImageId: id,
            maxTotalItems: maxTotalItemsAfterDelete,
          });
          await Swal.fire({
            ...swalOptions,
            icon: "success",
            title: "Permanently Deleted",
            text: "The image has been completely removed from the database.",
          });
        } catch (err) {
          await Swal.fire({
            ...swalOptions,
            icon: "error",
            title: "Could not delete image",
            text: err.message || "Please try again.",
          });
        } finally {
          setDeletingId(null);
        }
        return;
      }

      return;
    }

    const confirmation = await Swal.fire({
      ...swalOptions,
      cancelButtonColor: "#273441",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b84f57",
      confirmButtonText: "Delete Permanently",
      icon: "warning",
      reverseButtons: true,
      showCancelButton: true,
      text: `"${getImageName(image)}" will be permanently removed from the database.`,
      title: "Delete permanently?",
    });

    if (!confirmation.isConfirmed) return;

    setDeletingId(id);
    try {
      const currentTotal = toFiniteNumber(meta.totalItems);
      const maxTotalItemsAfterDelete = Math.max(0, (currentTotal ?? images.length) - 1);

      await deleteImage(id, token);
      setImages((current) => current.filter((img) => String(img.id) !== String(id)));
      setMeta((current) => limitMetaTotal(current, maxTotalItemsAfterDelete));
      await loadImages(activeCategory, page, {
        deletedImageId: id,
        maxTotalItems: maxTotalItemsAfterDelete,
      });
      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Image deleted",
        text: "The image has been permanently removed from the gallery.",
      });
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not delete image",
        text: err.message || "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const startEditTitle = (image) => {
    setEditingTitleId(image.id);
    setEditingTitle(getImageName(image));
  };

  const handleSaveTitle = async (imageId) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;
    setSavingTitleId(imageId);
    try {
      const currentImage = images.find((img) => String(img.id) === String(imageId));
      const result = await updateGalleryImageTitle(imageId, trimmed, token);
      const updatedImage = result.data || {};
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, ...updatedImage, title: updatedImage.title || trimmed } : img
        )
      );
      setEditingTitleId(null);
      const categoryIdsToSync = activeCategory
        ? getBirdCategoryIds(categories, [activeCategory])
        : getBirdCategoryIds(categories, getImageCategoryIds({ ...currentImage, ...updatedImage }));
      for (const categoryId of categoryIdsToSync) {
        await syncCategoryAlphabeticalSortOrder(categoryId, token);
      }
      if (categoryIdsToSync.length) await loadImages(activeCategory, page);
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not update title",
        text: err.message || "Please try again.",
      });
    } finally {
      setSavingTitleId(null);
    }
  };

  const startEditCategories = (image) => {
    setEditingTitleId(null);
    setEditingCategoriesId(image.id);
    setEditingCategoryIds((image.categories || []).map((cat) => String(cat.id)));
  };

  const toggleEditCategory = (id) => {
    const categoryId = String(id);
    setEditingCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId]
    );
  };

  const handleSaveCategories = async (imageId) => {
    if (editingCategoryIds.length === 0) {
      await Swal.fire({
        ...swalOptions,
        icon: "info",
        title: "Select a category",
        text: "Choose at least one category before saving.",
      });
      return;
    }

    setSavingCategoriesId(imageId);
    try {
      await updateGalleryImageCategories(imageId, editingCategoryIds, token);
      setEditingCategoriesId(null);
      for (const categoryId of getBirdCategoryIds(categories, editingCategoryIds)) {
        await syncCategoryAlphabeticalSortOrder(categoryId, token);
      }
      await loadImages(activeCategory, page);
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not update categories",
        text: err.message || "Please try again.",
      });
    } finally {
      setSavingCategoriesId(null);
    }
  };

  const handleToggleIsNew = async (image) => {
    const currentStatus = whatsNewIds.has(String(image.id)) || isMarkedNew(image);
    const newStatus = !currentStatus;
    try {
      // Optimistically update UI
      setWhatsNewIds((current) => {
        const next = new Set(current);
        if (newStatus) next.add(String(image.id));
        else next.delete(String(image.id));
        return next;
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? { ...img, isNew: newStatus, is_new: newStatus }
            : img
        )
      );
      await updateGalleryImageIsNew(image.id, newStatus, token);
    } catch (err) {
      // Revert on error
      setWhatsNewIds((current) => {
        const next = new Set(current);
        if (currentStatus) next.add(String(image.id));
        else next.delete(String(image.id));
        return next;
      });
      setImages((prev) =>
        prev.map((img) => (img.id === image.id ? { ...img, isNew: currentStatus, is_new: currentStatus } : img))
      );
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not update What's New status",
        text: err.message || "Please try again.",
      });
    }
  };

  const handleWhatsNewFactChange = (imageId, value) => {
    setWhatsNewFactDrafts((current) => ({ ...current, [imageId]: value }));
  };

  const toggleWhatsNewFactPanel = (imageId) => {
    setExpandedFactIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const handleSaveWhatsNewFact = async (image) => {
    const fact = (whatsNewFactDrafts[image.id] || "").trim();
    if (!fact) {
      await Swal.fire({
        ...swalOptions,
        icon: "info",
        title: "Fact is required",
        text: "Please add a fact before saving.",
      });
      return;
    }

    setSavingWhatsNewFactId(image.id);
    try {
      const result = await updateGalleryImageNewTitle(image.id, fact, token);
      const updatedImage = result.data || {};
      setWhatsNewIds((current) => {
        const next = new Set(current);
        next.add(String(image.id));
        return next;
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? { ...img, ...updatedImage, title: img.title, isNew: true, is_new: true, whatsNewFact: fact }
            : img
        )
      );
      await Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Fact saved",
        text: "The What's New fact has been updated.",
      });
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not save fact",
        text: err.message || "Please try again.",
      });
    } finally {
      setSavingWhatsNewFactId(null);
    }
  };

  const handleClearWhatsNewFact = (image) => {
    setWhatsNewFactDrafts((current) => ({ ...current, [image.id]: "" }));
  };

  const handleSortOrderChange = (imageId, value) => {
    setSortOrderDrafts((current) => ({
      ...current,
      [getSortOrderDraftKey(imageId, activeCategory)]: value,
    }));
  };

  const handleSaveSortOrder = async (image) => {
    if (!activeCategory) {
      await Swal.fire({
        ...swalOptions,
        icon: "info",
        title: "Select a category",
        text: "Choose a specific category before saving image order.",
      });
      return;
    }

    if (isBirdsCategory(getCategoryById(categories, activeCategory))) {
      await Swal.fire({
        ...swalOptions,
        icon: "info",
        title: "Birds are alphabetical",
        text: "The Birds category is kept in alphabetical order by image title.",
      });
      return;
    }

    const sortOrder = Number(sortOrderDrafts[getSortOrderDraftKey(image.id, activeCategory)]);
    if (!Number.isInteger(sortOrder) || sortOrder <= 0) {
      await Swal.fire({
        ...swalOptions,
        icon: "info",
        title: "Invalid order",
        text: "Enter a positive whole number for the image order.",
      });
      return;
    }

    setSavingSortOrderId(image.id);
    try {
      const selectedCategory = getCategoryById(categories, activeCategory);
      const fullImageResult =
        viewMode === "list"
          ? { images }
          : await fetchAllGalleryImages({ categoryId: activeCategory, limit: GALLERY_LIST_PAGE_SIZE });
      const currentImages = sortGalleryImages(
        fullImageResult.images,
        activeCategory,
        selectedCategory
      );
      const currentIndex = currentImages.findIndex((item) => String(item.id) === String(image.id));

      if (currentIndex === -1) {
        throw new Error("Image is not available in the current category list.");
      }

      const targetIndex = Math.min(Math.max(sortOrder - 1, 0), currentImages.length - 1);
      const reorderedImages = [...currentImages];
      const [movedImage] = reorderedImages.splice(currentIndex, 1);
      reorderedImages.splice(targetIndex, 0, movedImage);

      const reorderedImagesWithOrder = reorderedImages.map((item, index) =>
        withCategorySortOrder(item, activeCategory, index + 1)
      );
      const lastIndexToRefresh = Math.max(currentIndex, targetIndex);
      const pageStartIndex = viewMode === "list" ? 0 : (Math.max(1, Number(page) || 1) - 1) * GALLERY_PAGE_SIZE;
      const getVisibleImages = (orderedImages) =>
        viewMode === "list"
          ? orderedImages
          : orderedImages.slice(pageStartIndex, pageStartIndex + GALLERY_PAGE_SIZE);

      setImages(applyWhatsNewState(getVisibleImages(reorderedImagesWithOrder), whatsNewIds));
      setSortOrderDrafts((current) => {
        const next = { ...current };
        reorderedImagesWithOrder.forEach((item, index) => {
          next[getSortOrderDraftKey(item.id, activeCategory)] = String(index + 1);
        });
        return next;
      });

      setSavingSortOrderId(null);
      void Swal.fire({
        ...swalOptions,
        icon: "success",
        title: "Order saved",
        text: "The image order has been updated.",
      });

      const savedImageById = new Map();
      for (let index = lastIndexToRefresh; index >= 0; index -= 1) {
        const item = reorderedImagesWithOrder[index];
        const result = await updateGalleryImageSortOrder(
          item.id,
          {
            title: getImageName(item),
            categories: getSortOrderPayloadCategories(item, activeCategory, index + 1),
          },
          token
        );
        if (result?.data) {
          savedImageById.set(String(item.id), result.data);
        }
      }

      const savedReorderedImages = reorderedImagesWithOrder.map((item, index) => {
        const responseImage = savedImageById.get(String(item.id));
        const itemWithRequestedOrder = withCategorySortOrder(item, activeCategory, index + 1);
        return responseImage
          ? mergeImageSortOrderFromResponse(itemWithRequestedOrder, responseImage, activeCategory)
          : itemWithRequestedOrder;
      });

      setImages(applyWhatsNewState(getVisibleImages(savedReorderedImages), whatsNewIds));
    } catch (err) {
      await Swal.fire({
        ...swalOptions,
        icon: "error",
        title: "Could not save order",
        text: err.message || "Please try again.",
      });
    } finally {
      setSavingSortOrderId(null);
    }
  };

  const renderSortOrderControl = (image, className = "") => {
    const birdsCategoryActive = isBirdsCategory(getCategoryById(categories, activeCategory));
    const disabled = !activeCategory || birdsCategoryActive || savingSortOrderId === image.id;
    const draftKey = getSortOrderDraftKey(image.id, activeCategory);

    return (
      <div className={`eloquent-sort-order-control ${className}`.trim()}>
        <span>{birdsCategoryActive ? "Alphabetical" : "Order"}</span>
        <input
          aria-label={`Sort order for ${getImageName(image)}`}
          disabled={disabled}
          min="1"
          onChange={(event) => handleSortOrderChange(image.id, event.target.value)}
          type="number"
          value={sortOrderDrafts[draftKey] || ""}
        />
        <button
          disabled={disabled}
          onClick={() => handleSaveSortOrder(image)}
          title={
            birdsCategoryActive
              ? "Birds are sorted alphabetically"
              : activeCategory
                ? "Save order"
                : "Select a category first"
          }
          type="button"
        >
          <Icon
            className={savingSortOrderId === image.id ? "eloquent-contact-spinner" : ""}
            icon={savingSortOrderId === image.id ? "solar:refresh-linear" : "solar:diskette-linear"}
            width="15"
          />
        </button>
      </div>
    );
  };

  const renderWhatsNewControl = (image, isNew, className = "") => {
    const factValue = whatsNewFactDrafts[image.id] ?? getWhatsNewFact(image);
    const isSavingFact = savingWhatsNewFactId === image.id;
    const isFactPanelOpen = expandedFactIds.has(image.id);

    return (
      <div className={`eloquent-whats-new-wrap ${className}`.trim()}>
        <button
          className={`eloquent-whats-new-toggle${isNew ? " is-active" : ""}`}
          type="button"
          onClick={() => handleToggleIsNew(image)}
        >
          <Icon
            icon={isNew ? "solar:check-circle-bold" : "solar:check-circle-linear"}
            width="16"
          />
          <span>{isNew ? "Added to What's New" : "Show in What's New"}</span>
        </button>

        {isNew && (
          <button
            className="eloquent-whats-new-fact-toggle"
            type="button"
            onClick={() => toggleWhatsNewFactPanel(image.id)}
          >
            <Icon icon={isFactPanelOpen ? "solar:alt-arrow-up-linear" : "solar:notes-linear"} width="15" />
            <span>{isFactPanelOpen ? "Close Fact" : factValue.trim() ? "Edit Fact" : "Add Fact"}</span>
          </button>
        )}

        {isNew && isFactPanelOpen && (
          <div className="eloquent-whats-new-fact">
            <label htmlFor={`whats-new-fact-${image.id}`}>Interesting fact</label>
            <textarea
              disabled={isSavingFact}
              id={`whats-new-fact-${image.id}`}
              onChange={(event) => handleWhatsNewFactChange(image.id, event.target.value)}
              placeholder="Add any facts or interesting notes for What's New..."
              rows="3"
              value={factValue}
            />
            <div>
              <button
                disabled={isSavingFact}
                onClick={() => handleSaveWhatsNewFact(image)}
                type="button"
              >
                <Icon
                  className={isSavingFact ? "eloquent-contact-spinner" : ""}
                  icon={isSavingFact ? "solar:refresh-linear" : "solar:diskette-linear"}
                  width="15"
                />
                Save Fact
              </button>
              <button
                disabled={isSavingFact}
                onClick={() => toggleWhatsNewFactPanel(image.id)}
                type="button"
              >
                Close
              </button>
              <button
                disabled={isSavingFact || !factValue.trim()}
                onClick={() => handleClearWhatsNewFact(image)}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <MasterLayout>
      <div className="eloquent-contact-heading">
        <div className="eloquent-page-head" style={{ margin: 0 }}>
          <span>Eloquent Images</span>
          <h2>Gallery</h2>
          <p>Upload, organize, and manage photography from one clean workspace.</p>
        </div>
        <button
          className="eloquent-btn eloquent-refresh-btn"
          onClick={() => navigate("/gallery/create")}
          type="button"
        >
          <Icon icon="solar:gallery-add-linear" width="18" />
          Upload Image
        </button>
      </div>

      {error && <div className="eloquent-alert error mt-4">{error}</div>}

      <section className="eloquent-panel eloquent-library-panel mt-4">
        <div className="eloquent-library-heading">
          <div>
            <span className="eloquent-section-icon">
              <Icon icon="solar:gallery-wide-linear" width="22" />
            </span>
            <div>
              <h3>Media Library</h3>
              <p>
                {loadingImages
                  ? "Loading images..."
                  : `${meta.totalItems ?? images.length} images in this collection`}
              </p>
            </div>
          </div>
        </div>

        <div className="eloquent-filter-row">
          <span>Filter by category</span>
          <div>
            <button
              className={`eloquent-chip ${activeCategory === "" ? "active" : ""}`}
              onClick={() => selectCategory("")}
              type="button"
            >
              All images
            </button>
            {categories.map((category) => (
              <button
                className={`eloquent-chip ${
                  String(activeCategory) === String(category.id) ? "active" : ""
                }`}
                key={category.id}
                onClick={() => selectCategory(category.id)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="eloquent-gallery-view-row">
          <div>
            <strong>{viewMode === "list" ? "Complete list" : "Grid view"}</strong>
            <span>
              {viewMode === "list"
                ? "Showing the full selected collection without paging."
                : "Showing 15 images per page."}
            </span>
          </div>
          <div className="eloquent-gallery-view-toggle">
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => selectViewMode("grid")}
                type="button"
              >
                <Icon icon="solar:widget-4-linear" width="17" />
                Grid
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => selectViewMode("list")}
                type="button"
              >
                <Icon icon="solar:list-linear" width="17" />
                List / Show All
              </button>
          </div>
        </div>

        {loadingImages ? (
          <div className="eloquent-gallery-state">
            <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="28" />
            <strong>Loading media library...</strong>
          </div>
        ) : images.length === 0 ? (
          <div className="eloquent-gallery-state">
            <Icon icon="solar:gallery-remove-linear" width="32" />
            <strong>No images in this category</strong>
            <span>Upload an image or choose another category.</span>
          </div>
        ) : viewMode === "list" ? (
          <div className="eloquent-gallery-list-wrap">
            <table className="eloquent-gallery-list">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Order</th>
                  <th>Title</th>
                  <th>Categories</th>
                  <th>What's New</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => {
                  const isNew = isMarkedNew(image);
                  return (
                    <tr key={image.id}>
                      <td>
                        <div className="eloquent-gallery-list-thumb">
                          <EloquentImage alt={getImageName(image)} src={image.imageUrl} />
                        </div>
                      </td>
                      <td>
                        {renderSortOrderControl(image)}
                      </td>
                      <td>
                        {editingTitleId === image.id ? (
                          <div className="eloquent-gallery-title-edit">
                            <input
                              autoFocus
                              className="eloquent-gallery-title-input"
                              disabled={savingTitleId === image.id}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveTitle(image.id);
                                if (e.key === "Escape") setEditingTitleId(null);
                              }}
                              value={editingTitle}
                            />
                            <button
                              className="eloquent-gallery-title-save"
                              disabled={savingTitleId === image.id || !editingTitle.trim()}
                              onClick={() => handleSaveTitle(image.id)}
                              title="Save"
                              type="button"
                            >
                              <Icon
                                className={savingTitleId === image.id ? "eloquent-contact-spinner" : ""}
                                icon={savingTitleId === image.id ? "solar:refresh-linear" : "solar:check-read-linear"}
                                width="15"
                              />
                            </button>
                            <button
                              className="eloquent-gallery-title-cancel"
                              disabled={savingTitleId === image.id}
                              onClick={() => setEditingTitleId(null)}
                              title="Cancel"
                              type="button"
                            >
                              <Icon icon="solar:close-circle-linear" width="15" />
                            </button>
                          </div>
                        ) : (
                          <strong title={getImageName(image)}>{getImageName(image)}</strong>
                        )}
                      </td>
                      <td>
                        <span>
                          {getImageCategoryNames(image) || "Uncategorized"}
                        </span>
                      </td>
                      <td>
                        {renderWhatsNewControl(image, isNew, "eloquent-whats-new-wrap-table")}
                      </td>
                      <td>
                        <div className="eloquent-gallery-list-actions">
                          <button
                            className="eloquent-gallery-title-btn"
                            onClick={() => startEditTitle(image)}
                            title="Edit title"
                            type="button"
                          >
                            <Icon icon="solar:pen-linear" width="15" />
                          </button>
                          <button
                            className="eloquent-gallery-delete-btn"
                            aria-label={`Delete ${getImageName(image)}`}
                            disabled={deletingId === image.id}
                            onClick={() => handleDelete(image)}
                            title="Delete image"
                            type="button"
                          >
                            <Icon
                              className={deletingId === image.id ? "eloquent-contact-spinner" : ""}
                              icon={
                                deletingId === image.id
                                  ? "solar:refresh-linear"
                                  : "solar:trash-bin-trash-linear"
                              }
                              width="18"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="eloquent-gallery-grid">
            {images.map((image) => {
              const isNew = isMarkedNew(image);

              return (
              <article className="eloquent-gallery-card" key={image.id}>
                <div className="eloquent-gallery-media">
                  <EloquentImage
                    alt={getImageName(image)}
                    className="eloquent-gallery-img"
                    src={image.imageUrl}
                  />
                  <span title={getImageName(image)}>{getImageName(image)}</span>
                </div>
                {editingCategoriesId === image.id ? (
                  <div className="eloquent-gallery-category-edit">
                    <div className="eloquent-field-label">
                      <span>Categories</span>
                      <small>{editingCategoryIds.length} selected</small>
                    </div>
                    <div className="eloquent-category-options">
                      {categories.map((category) => {
                        const selected = editingCategoryIds.includes(String(category.id));
                        return (
                          <button
                            className={selected ? "selected" : ""}
                            disabled={savingCategoriesId === image.id}
                            key={category.id}
                            onClick={() => toggleEditCategory(category.id)}
                            type="button"
                          >
                            <Icon
                              icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"}
                              width="16"
                            />
                            {category.name}
                          </button>
                        );
                      })}
                      {categories.length === 0 && <span>No categories available.</span>}
                    </div>
                    <div className="eloquent-gallery-category-edit-actions">
                      <button
                        className="eloquent-btn eloquent-btn-secondary"
                        disabled={savingCategoriesId === image.id}
                        onClick={() => setEditingCategoriesId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="eloquent-btn"
                        disabled={savingCategoriesId === image.id || editingCategoryIds.length === 0}
                        onClick={() => handleSaveCategories(image.id)}
                        type="button"
                      >
                        <Icon
                          className={savingCategoriesId === image.id ? "eloquent-contact-spinner" : ""}
                          icon={savingCategoriesId === image.id ? "solar:refresh-linear" : "solar:check-circle-linear"}
                          width="16"
                        />
                        {savingCategoriesId === image.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="eloquent-gallery-card-body">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {editingTitleId === image.id ? (
                      <div className="eloquent-gallery-title-edit">
                        <input
                          autoFocus
                          className="eloquent-gallery-title-input"
                          disabled={savingTitleId === image.id}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTitle(image.id);
                            if (e.key === "Escape") setEditingTitleId(null);
                          }}
                          value={editingTitle}
                        />
                        <button
                          className="eloquent-gallery-title-save"
                          disabled={savingTitleId === image.id || !editingTitle.trim()}
                          onClick={() => handleSaveTitle(image.id)}
                          title="Save"
                          type="button"
                        >
                          <Icon
                            className={savingTitleId === image.id ? "eloquent-contact-spinner" : ""}
                            icon={savingTitleId === image.id ? "solar:refresh-linear" : "solar:check-read-linear"}
                            width="15"
                          />
                        </button>
                        <button
                          className="eloquent-gallery-title-cancel"
                          disabled={savingTitleId === image.id}
                          onClick={() => setEditingTitleId(null)}
                          title="Cancel"
                          type="button"
                        >
                          <Icon icon="solar:close-circle-linear" width="15" />
                        </button>
                      </div>
                    ) : (
                      <strong title={getImageName(image)}>{getImageName(image)}</strong>
                    )}
                    <small>
                      {getImageCategoryNames(image) || "Uncategorized"}
                    </small>
                  </div>
                  {editingTitleId !== image.id && (
                    <div className="eloquent-gallery-card-actions">
                      <button
                        className="eloquent-gallery-title-btn"
                        onClick={() => startEditTitle(image)}
                        title="Edit title"
                        type="button"
                      >
                        <Icon icon="solar:pen-linear" width="15" />
                      </button>
                      <button
                        className="eloquent-gallery-title-btn"
                        onClick={() => startEditCategories(image)}
                        title="Edit categories"
                        type="button"
                      >
                        <Icon icon="solar:tag-linear" width="15" />
                      </button>
                      <button
                        className="eloquent-gallery-delete-btn"
                        aria-label={`Delete ${getImageName(image)}`}
                        disabled={deletingId === image.id}
                        onClick={() => handleDelete(image)}
                        title="Delete image"
                        type="button"
                      >
                        <Icon
                          className={deletingId === image.id ? "eloquent-contact-spinner" : ""}
                          icon={
                            deletingId === image.id
                              ? "solar:refresh-linear"
                              : "solar:trash-bin-trash-linear"
                          }
                          width="18"
                        />
                      </button>
                    </div>
                  )}
                  {renderWhatsNewControl(image, isNew)}
                  {renderSortOrderControl(image, "eloquent-sort-order-control-card")}
                </div>
                )}
              </article>
              );
            })}
          </div>
        )}

        {!loadingImages && images.length > 0 && viewMode === "grid" && (
          <div className="eloquent-contact-pagination eloquent-gallery-pagination">
            <span>
              Page {meta.currentPage ?? page} of {meta.totalPages ?? 1}
            </span>
            <div>
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                <Icon icon="solar:alt-arrow-left-linear" width="17" />
                Previous
              </button>
              <button
                disabled={page >= (meta.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
                <Icon icon="solar:alt-arrow-right-linear" width="17" />
              </button>
            </div>
          </div>
        )}
      </section>
    </MasterLayout>
  );
};

export default EloquentGalleryPage;
