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