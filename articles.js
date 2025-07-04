// Toggle sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('active');
}

// Close sidebar when clicking outside
document.addEventListener('click', function(event) {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.querySelector('.hamburger');
  if (!sidebar.contains(event.target) && !hamburger.contains(event.target)) {
    sidebar.classList.remove('active');
  }
});

// Search functionality
async function searchItems() {
  const input = document.getElementById('searchBox').value;
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (input.length > 0) {
    const response = await fetch('articles.json');
    const articles = await response.json();

    const filteredArticles = articles.filter(article => 
      article.title.toLowerCase().includes(input.toLowerCase()) ||
      article.description.toLowerCase().includes(input.toLowerCase())
    );

    if (filteredArticles.length > 0) {
      document.getElementById('searchResults').style.display = 'block'; // Show results
      filteredArticles.forEach(article => {
        const articleDiv = document.createElement('div');
        articleDiv.className = 'article';
        articleDiv.innerHTML = `
          <a href="${article.link}" target="_blank">
            <img src="${article.img}" alt="${article.alt}" />
            <h3>${article.title}</h3>
            <p>${article.description}</p>
          </a>
        `;
        resultsContainer.appendChild(articleDiv);
      });
    } else {
      document.getElementById('searchResults').style.display = 'none'; // Hide results if no match
    }
  } else {
    document.getElementById('searchResults').style.display = 'none'; // Hide results if input is empty
  }
}

// Close search results
function closeSearchResults() {
  document.getElementById('searchResults').style.display = 'none'; // Hide results
}

// Close search results when clicking outside
document.addEventListener('click', function(event) {
  const resultsContainer = document.getElementById('searchResults');
  const searchBox = document.getElementById('searchBox');
  if (!resultsContainer.contains(event.target) && event.target !== searchBox) {
    resultsContainer.style.display = 'none'; // Hide results
  }
});


// Wait until DOM is fully loaded for copyrightYear in footer
document.addEventListener('DOMContentLoaded', () => {
  let copyrightDate = new Date();
  const copyrightYear = document.getElementById('copyrightYear');

  // Add null check for safety
  if (copyrightYear) {
    copyrightYear.innerText = copyrightDate.getFullYear().toString();
   } else {
    console.error('Element with ID "copyrightYear" not found!');
  }
});
