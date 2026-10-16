"use strict";
window.PCBRecovery = {
  async load({ id, request, discard, viewResult = false }) {
    if (!id) return;
    let state;
    try {
      state = await request(`/api/sessions/${encodeURIComponent(id)}/state`);
    } catch (error) {
      if (viewResult || ![404, 410].includes(error.status)) throw error;
      discard();
      return;
    }
    if (state.completed && !viewResult) {
      discard();
      return;
    }
    return state;
  },
};
