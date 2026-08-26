(() => {
  if (window.__ROB_CONTROL_ACTION_RETRY__) return;
  window.__ROB_CONTROL_ACTION_RETRY__ = true;

  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  window.fetch = async (input, init = {}) => {
    const isActionPost =
      typeof input === 'string' &&
      input === '/api/action' &&
      String(init.method || 'GET').toUpperCase() === 'POST';
    if (!isActionPost) return nativeFetch(input, init);

    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await nativeFetch(input, init);
      if (response.status !== 503) return response;
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
    return response;
  };
})();
