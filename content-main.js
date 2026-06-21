// content-main.js
// Runs in the MAIN world to access window.monaco

(function() {
  document.addEventListener('LEETCODE_REQUEST_CODE', () => {
    let code = "";
    try {
      const monaco = window.monaco;
      if (monaco && monaco.editor) {
        const models = monaco.editor.getModels();
        if (models && models.length > 0) {
          // Filter out internal Monaco type definitions
          const userCodeModel = models.find(m => {
            const uri = m.uri.toString();
            return !uri.includes('node_modules') && 
                   !uri.includes('lib.d.ts') && 
                   !uri.includes('typescript') &&
                   !uri.endsWith('.d.ts');
          });
          
          if (userCodeModel) {
            code = userCodeModel.getValue();
          } else {
            // Fallback to the first model if filtering yields nothing
            code = models[0].getValue();
          }
        }
      }
    } catch (err) {
      console.error("LeetCode Companion: Failed to extract code from Monaco editor", err);
    }
    
    // Dispatch response back to isolated world content.js
    document.dispatchEvent(new CustomEvent('LEETCODE_RESPONSE_CODE', {
      detail: { code }
    }));
  });
})();
