import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  fetchCategories,
  fetchWhatsNewGalleryImages,
  getAuthSession,
  updateGalleryImageIsNew,
  updateGalleryImageNewTitle,
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

function shuffleArray(array = []) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getImageCategoryNames(image = {}) {
  return (image.categories || [])
    .map((category) => category.name || category.category?.name)
    .filter(Boolean)
    .join(", ");
}

const EloquentWhatsNewPage = () => {
  const token = getAuthSession()?.token;
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingFactId, setSavingFactId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  const sortedImages = images;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryData, imageData] = await Promise.all([fetchCategories(), fetchWhatsNewGalleryImages()]);
      const sortedCategoryData = Array.isArray(categoryData) ? categoryData : [];
      setCategories(sortedCategoryData);
      const randomizedImages = shuffleArray(imageData || []);
      setImages(randomizedImages);
      setDrafts((current) => {
        const next = { ...current };
        imageData.forEach((image) => {
          next[image.id] = current[image.id] ?? getWhatsNewFact(image);
        });
        return next;
      });
    } catch (err) {
      setError(err.message || "Unable to load What's New images.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleFactChange = (imageId, value) => {
    setDrafts((current) => ({ ...current, [imageId]: value }));
  };

  const handleSaveFact = async (image) => {
    const fact = (drafts[image.id] || "").trim();
    if (!fact) {
      await Swal.fire({ ...swalOptions, icon: "info", title: "Fact is required" });
      return;
    }

    setSavingFactId(image.id);
    try {
      const result = await updateGalleryImageNewTitle(image.id, fact, token);
      const updatedImage = result.data || {};
      setImages((current) =>
        current.map((item) =>
          item.id === image.id ? { ...item, ...updatedImage, title: item.title, whatsNewFact: fact } : item
        )
      );
      await Swal.fire({ ...swalOptions, icon: "success", title: "Fact saved" });
    } catch (err) {
      await Swal.fire({ ...swalOptions, icon: "error", title: "Could not save fact", text: err.message });
    } finally {
      setSavingFactId(null);
    }
  };

  const handleRemove = async (image) => {
    const confirmation = await Swal.fire({
      ...swalOptions,
      cancelButtonColor: "#273441",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b84f57",
      confirmButtonText: "Remove",
      icon: "warning",
      reverseButtons: true,
      showCancelButton: true,
      text: `${getImageName(image)} will be removed from What's New.`,
      title: "Remove from What's New?",
    });

    if (!confirmation.isConfirmed) return;
    setRemovingId(image.id);
    try {
      await updateGalleryImageIsNew(image.id, false, token);
      setImages((current) => current.filter((item) => item.id !== image.id));
      await Swal.fire({ ...swalOptions, icon: "success", title: "Removed from What's New" });
    } catch (err) {
      await Swal.fire({ ...swalOptions, icon: "error", title: "Could not remove image", text: err.message });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <MasterLayout>
      <div className="eloquent-contact-heading">
        <div className="eloquent-page-head" style={{ margin: 0 }}>
          <span>Eloquent Images</span>
          <h2>What's New</h2>
          <p>{loading ? "Loading What's New images..." : `${sortedImages.length} images in What's New`}</p>
        </div>
        <button className="eloquent-btn eloquent-refresh-btn" onClick={loadPage} type="button">
          <Icon icon="solar:refresh-linear" width="18" />
          Refresh
        </button>
      </div>

      {error && <div className="eloquent-alert error mt-4">{error}</div>}

      <section className="eloquent-panel eloquent-whats-new-manager mt-4">
        {!loading && sortedImages.length > 0 && (
          <div className="eloquent-whats-new-summary">
            <div>
              <span>Total What's New</span>
              <strong>{sortedImages.length}</strong>
            </div>
            <p>Sequence is randomized so What's New displays a fresh, random order.</p>
          </div>
        )}

        {loading ? (
          <div className="eloquent-gallery-state">
            <Icon className="eloquent-contact-spinner" icon="solar:refresh-linear" width="28" />
            <strong>Loading What's New...</strong>
          </div>
        ) : sortedImages.length === 0 ? (
          <div className="eloquent-gallery-state">
            <Icon icon="solar:gallery-remove-linear" width="32" />
            <strong>No What's New images found.</strong>
          </div>
        ) : (
          <div className="eloquent-whats-new-list">
            {sortedImages.map((image, index) => (
              <article className="eloquent-whats-new-row" key={image.id}>
                <div className="eloquent-whats-new-order">
                  <span>Order</span>
                  <strong>{index + 1}</strong>
                </div>
                <EloquentImage alt={getImageName(image)} src={image.imageUrl} />
                <div className="eloquent-whats-new-main">
                  <div>
                    <strong>{getImageName(image)}</strong>
                    <span>{getImageCategoryNames(image) || "No category"}</span>
                  </div>
                  <textarea
                    disabled={savingFactId === image.id}
                    onChange={(event) => handleFactChange(image.id, event.target.value)}
                    placeholder="Add any facts or interesting notes for What's New..."
                    rows="4"
                    value={drafts[image.id] || ""}
                  />
                </div>
                <div className="eloquent-whats-new-actions">
                  <button
                    disabled={savingFactId === image.id}
                    onClick={() => handleSaveFact(image)}
                    type="button"
                  >
                    <Icon
                      className={savingFactId === image.id ? "eloquent-contact-spinner" : ""}
                      icon={savingFactId === image.id ? "solar:refresh-linear" : "solar:diskette-linear"}
                      width="15"
                    />
                    Save Fact
                  </button>
                  <button disabled={removingId === image.id} onClick={() => handleRemove(image)} type="button">
                    <Icon
                      className={removingId === image.id ? "eloquent-contact-spinner" : ""}
                      icon={removingId === image.id ? "solar:refresh-linear" : "solar:trash-bin-trash-linear"}
                      width="15"
                    />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </MasterLayout>
  );
};

export default EloquentWhatsNewPage;
