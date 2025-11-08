(function () {
  const { showHighlightPopup } = window.Clarity.Popup;
  const { showTagActionsMenu, scheduleHoverMenuHide } = window.Clarity.HighlightCore;
  const { startPolling } = window.Clarity.Clipboard;

  startPolling();

  let popupTimer = null;
  let isMouseDown = false;
  let interactingWithUi = false;
  const clearPopupTimer = () => {
    if (popupTimer) {
      clearTimeout(popupTimer);
      popupTimer = null;
    }
  };
  const removePopupIfAny = () => {
    const p = document.getElementById("highlightPopup");
    if (p) p.remove();
  };

  const isInOurUi = (target) => {
    if (!target || !target.closest) return false;
    return Boolean(
      target.closest(
        '#highlightPopup, #clipboardHistoryCard, #tagActionsMenu, #highlightsPanel, #highlightColorPicker, #summaryModal, #notesModal'
      )
    );
  };

  document.addEventListener("dblclick", () => {
    clearPopupTimer();
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length) {
      showHighlightPopup();
    }
  });

  document.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    interactingWithUi = isInOurUi(e.target);
    clearPopupTimer();
    if (!interactingWithUi) {
      removePopupIfAny();
    }
  });

  document.addEventListener("mouseup", (e) => {
    isMouseDown = false;
    clearPopupTimer();
    if (interactingWithUi || isInOurUi(e.target)) {
      interactingWithUi = false;
      return;
    }
    popupTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const text = sel.toString().trim();
      if (!text || sel.isCollapsed) return;
      showHighlightPopup();
    }, 140);
  });

  document.addEventListener("selectionchange", () => {
    if (interactingWithUi) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text || (sel && sel.isCollapsed)) {
      clearPopupTimer();
      removePopupIfAny();
    }
  });

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".clarity-highlight");
    if (!el) return;
    if (el.contains(e.relatedTarget)) return;
    showTagActionsMenu(el);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest && e.target.closest(".clarity-highlight");
    if (!el) return;
    if (el.contains(e.relatedTarget)) return;
    scheduleHoverMenuHide(el);
  });
})();

