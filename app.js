document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('category-selector');
  if (container) {
    container.innerHTML = '<button class="mode-btn active">TEST_CATEGORY</button>';
    console.log("Test category injected");
  } else {
    console.error("Category selector container not found");
  }
});
