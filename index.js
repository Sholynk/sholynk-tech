 
   (() => {
    // Hero slides data (up to 12)
    const heroSlides = [
      {
        category: "Tech Trends",
        title: "Mastering the art of coding: 10 key areas every developer should focus on",
        description: "It's not just about writing lines of text it's the craft of transforming ideas into functional, impactful software that powers the digital world. Whether you're just starting out or looking to sharpen your skills, true excellence in coding comes from mastering the right ...",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "/articles/mastering_the_art_of_coding.html"
      },
      {
        category: "AI Trends",
        title: "The Future of Artificial Intelligence in Everyday Life",
        description: "AI is becoming an integral part of our daily routines, from smart assistants to personalized recommendations, transforming how we live and work.",
        img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Web 3",
        title: "Decentralized Finance: Changing the Financial Landscape",
        description: "DeFi platforms are revolutionizing finance by enabling peer-to-peer transactions without intermediaries, increasing transparency and accessibility.",
        img: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "Breakthroughs in Renewable Energy Technologies",
        description: "Innovations in solar, wind, and battery storage are accelerating the transition to sustainable energy worldwide.",
        img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "AI Trends",
        title: "Ethical AI: Navigating the Challenges",
        description: "As AI systems become more prevalent, ethical considerations around bias, privacy, and accountability are critical for responsible development.",
        img: "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "The Rise of Quantum Computing",
        description: "Quantum computing is set to revolutionize the way we solve complex problems, offering unprecedented processing power.",
        img: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Web 3",
        title: "Blockchain Beyond Cryptocurrency",
        description: "Blockchain technology is being applied in supply chain, healthcare, and voting systems to increase transparency and security.",
        img: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "5G Technology and Its Impact",
        description: "5G networks are transforming connectivity with faster speeds and lower latency, enabling new applications and services.",
        img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "AI Trends",
        title: "Machine Learning in Everyday Life",
        description: "Machine learning powers many applications from recommendation systems to fraud detection, impacting daily experiences.",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "Cybersecurity in the Modern Age",
        description: "As cyber threats evolve, new strategies and tools are essential to protect data and privacy.",
        img: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "The Role of IoT in Smart Cities",
        description: "Internet of Things devices are enabling smarter infrastructure, traffic management, and energy efficiency.",
        img: "https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      },
      {
        category: "Technology",
        title: "Virtual Reality in Education",
        description: "VR is transforming education by providing immersive learning experiences.",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1470&q=80",
        readMoreLink: "#"
      }
    ];

    const heroSection = document.querySelector(".hero-section");

    // Create slides
    heroSlides.forEach((slide, index) => {
      const slideEl = document.createElement("section");
      slideEl.className = "hero-slide";
      if (index === 0) slideEl.classList.add("active");
      slideEl.setAttribute("aria-hidden", index === 0 ? "false" : "true");
      slideEl.setAttribute("aria-label", `Slide ${index + 1} of ${heroSlides.length}`);

      slideEl.innerHTML = `
        <img src="${slide.img}" alt="${slide.title} background image" />
        <div class="hero-content">
          <span>${slide.category}</span>
          <h1>${slide.title}</h1>
          <p>${slide.description}</p>
          <a href="${slide.readMoreLink}" tabindex="0" aria-label="Read more about ${slide.title}">Read More</a>
        </div>
      `;
      heroSection.appendChild(slideEl);
    });

    let currentSlide = 0;
    const slides = document.querySelectorAll(".hero-slide");
    const totalSlides = slides.length;

    function showSlide(index) {
      slides.forEach((slide, i) => {
        if (i === index) {
          slide.classList.add("active");
          slide.setAttribute("aria-hidden", "false");
        } else {
          slide.classList.remove("active");
          slide.setAttribute("aria-hidden", "true");
        }
      });
    }

    // Auto slide every 5 seconds
    setInterval(() => {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    }, 5000);

    // The page JS (cards, pagination, search)
    const searchInput = document.getElementById("searchInput");
    const cardsContainer = document.getElementById("cardsContainer");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const paginationNumbers = document.getElementById("paginationNumbers");

    // Data for 20 cards
    const articles = [
      {
        title: "The Rise of Quantum Computing",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "Quantum computing is set to revolutionize the way we solve complex problems, offering unprecedented processing power.",
        img: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=160&q=80",
        alt: "Quantum computer with glowing blue lights and complex circuits"
      },
      {
        title: "Web3 and the Future of the Internet",
        link: "../articles/article_1.html",
        category: "Web 3",
        description: "Web3 promises a decentralized internet where users control their data and digital assets, reshaping online interactions.",
        img: "",
        alt: ""
      },
      {
        title: "AI in Healthcare: Transforming Patient Care",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "Artificial Intelligence is improving diagnostics, treatment plans, and patient monitoring, making healthcare more efficient and personalized.",
        img: "https://storage.googleapis.com/a1aa/image/bcacd612-69b2-4513-93cf-1b14fe4b9961.jpg",
        alt: "Doctor using AI technology on tablet in modern hospital"
      },
      {
        title: "Breakthroughs in Renewable Energy Tech",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "Innovations in solar, wind, and battery storage technologies are accelerating the transition to sustainable energy worldwide.",
        img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=160&q=80",
        alt: "Solar panels and wind turbines under blue sky"
      },
      {
        title: "AI Ethics: Navigating the Challenges",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "As AI systems become more prevalent, ethical considerations around bias, privacy, and accountability are critical for responsible development.",
        img: "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=160&q=80",
        alt: "Abstract image representing AI ethics with human and robot hands"
      },
      {
        title: "Decentralized Finance (DeFi) Growth",
        link: "../articles/article_1.html",
        category: "Web 3",
        description: "DeFi platforms are transforming traditional finance by enabling peer-to-peer transactions without intermediaries.",
        img: "",
        alt: ""
      },
      {
        title: "The Future of Augmented Reality",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "Augmented Reality is enhancing user experiences in gaming, education, and retail by blending digital content with the real world.",
        img: "",
        alt: ""
      },
      {
        title: "Advancements in Remote Work Tech",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "New tools and platforms are making remote work more productive and collaborative than ever before.",
        img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=160&q=80",
        alt: "Person working remotely on laptop with coffee and notebook"
      },
      {
        title: "5G Technology and Its Impact",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "5G networks are transforming connectivity with faster speeds and lower latency, enabling new applications and services.",
        img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=160&q=80",
        alt: "5G technology concept with network towers and digital connections"
      },
      {
        title: "Blockchain Beyond Cryptocurrency",
        link: "../articles/article_1.html",
        category: "Web 3",
        description: "Blockchain technology is being applied in supply chain, healthcare, and voting systems to increase transparency and security.",
        img: "",
        alt: ""
      },
      {
        title: "Machine Learning in Everyday Life",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "Machine learning powers many applications from recommendation systems to fraud detection, impacting daily experiences.",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=160&q=80",
        alt: "Abstract machine learning concept with data visualization"
      },
      {
        title: "Cybersecurity in the Modern Age",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "As cyber threats evolve, new strategies and tools are essential to protect data and privacy.",
        img: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=160&q=80",
        alt: "Cybersecurity concept with digital lock and code"
      },
      {
        title: "The Role of IoT in Smart Cities",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "Internet of Things devices are enabling smarter infrastructure, traffic management, and energy efficiency.",
        img: "https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&w=160&q=80",
        alt: "Smart city with connected IoT devices and data"
      },
      {
        title: "Ethical AI: Balancing Innovation and Responsibility",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "Developing AI responsibly requires addressing bias, transparency, and societal impact.",
        img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=160&q=80",
        alt: "Ethical AI concept with human and robot hands"
      },
      {
        title: "Virtual Reality in Education",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "VR is transforming education by providing immersive learning experiences.",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=160&q=80",
        alt: "Student using virtual reality headset in classroom"
      },
      {
        title: "Cryptocurrency Regulations Worldwide",
        link: "../articles/article_1.html",
        category: "Web 3",
        description: "Governments are shaping the future of cryptocurrencies with evolving regulations.",
        img: "",
        alt: ""
      },
      {
        title: "AI-Powered Customer Service",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "Chatbots and virtual assistants are improving customer interactions and support.",
        img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=160&q=80",
        alt: "AI chatbot concept with digital interface"
      },
      {
        title: "Sustainable Tech Innovations",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "New technologies are helping reduce environmental impact and promote sustainability.",
        img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=160&q=80",
        alt: "Green technology with solar panels and plants"
      },
      {
        title: "The Evolution of Cloud Computing",
        link: "../articles/article_1.html",
        category: "Technology",
        description: "Cloud computing continues to evolve, offering scalable and flexible solutions for businesses.",
        img: "https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&w=160&q=80",
        alt: "Cloud computing concept with servers and data"
      },
      {
        title: "AI and Automation in Manufacturing",
        link: "../articles/article_1.html",
        category: "AI Trends",
        description: "Automation powered by AI is increasing efficiency and precision in manufacturing processes.",
        img: "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=160&q=80",
        alt: "Robotic arm in manufacturing plant"
      }
    ];

    // Pagination variables
    const cardsPerPage = 6;
    let currentPage = 1;
    let filteredArticles = articles;

    // Function to create card HTML
    function createCard(article, index) {
      const hasImage = article.img && article.img.trim() !== "";
      const isWeb3 = article.category.toLowerCase() === "web 3";
      const isDeFi = isWeb3 && article.title.toLowerCase().includes("decentralized finance");
      // Determine classes for grid spans based on index (1-based)
      let gridSpanClasses = "";
      if (window.innerWidth >= 1024) {
        // lg screens
        if (index === 0) gridSpanClasses = "lg:col-span-5 lg:row-span-2";
        else if (index === 1) gridSpanClasses = "lg:col-span-3 lg:row-span-2";
        else if (index >= 2 && index <= 4) gridSpanClasses = "lg:col-span-2 lg:row-span-1";
        else if (index >= 5 && index <= 7) gridSpanClasses = "lg:col-span-2 lg:row-span-1";
        else if (index >= 8 && index <= 11) gridSpanClasses = "lg:col-span-2 lg:row-span-1";
        else gridSpanClasses = "lg:col-span-2 lg:row-span-1";
      } else if (window.innerWidth >= 640) {
        // sm screens
        if (index === 0) gridSpanClasses = "sm:col-span-4 sm:row-span-2";
        else if (index === 1) gridSpanClasses = "sm:col-span-2 sm:row-span-2";
        else if (index >= 2 && index <= 7) gridSpanClasses = "sm:col-span-2 sm:row-span-1";
        else if (index >= 8 && index <= 11) gridSpanClasses = "sm:col-span-2 sm:row-span-1";
        else gridSpanClasses = "sm:col-span-2 sm:row-span-1";
      }

      // Compose card classes
      let cardClasses = `card ${gridSpanClasses} focus:outline-none`;
      if (isWeb3 && !hasImage) {
        cardClasses += " web3-dark";
      }
      if (isDeFi) {
        cardClasses = `card ${gridSpanClasses} web3-blue focus:outline-none`;
      }
      if (hasImage && article.title === "The Rise of Quantum Computing") {
        cardClasses += " image-left";
      }
      if (hasImage && article.title !== "The Rise of Quantum Computing") {
        cardClasses += " image-below";
      }

      // Build card HTML
      if (isWeb3 && !hasImage) {
        return `
          <a href="${article.link}" role="article" tabindex="0" class="${cardClasses}" data-title="${article.title}" data-category="${article.category}" data-description="${article.description}">
            <span class="category-label">${article.category}</span>
            <h3>${article.title}</h3>
            <p>${article.description}</p>
          </a>
        `;
      }
      if (isDeFi) {
        return `
          <a href="${article.link}" role="article" tabindex="0" class="${cardClasses}" data-title="${article.title}" data-category="${article.category}" data-description="${article.description}">
            <span class="category-label">${article.category}</span>
            <h3>${article.title}</h3>
            <p>${article.description}</p>
          </a>
        `;
      }
      if (hasImage) {
        if (article.title === "The Rise of Quantum Computing") {
          return `
            <a href="${article.link}" role="article" tabindex="0" class="${cardClasses}" data-title="${article.title}" data-category="${article.category}" data-description="${article.description}">
              <img alt="${article.alt}" src="${article.img}" width="160" height="120" />
              <div class="text-content">
                <span class="category-label">${article.category}</span>
                <h3>${article.title}</h3>
                <p>${article.description}</p>
              </div>
            </a>
          `;
        }
        return `
          <a href="${article.link}" role="article" tabindex="0" class="${cardClasses}" data-title="${article.title}" data-category="${article.category}" data-description="${article.description}">
            <span class="category-label">${article.category}</span>
            <h3>${article.title}</h3>
            <p>${article.description}</p>
            <img alt="${article.alt}" src="${article.img}" width="160" height="120" />
          </a>
        `;
      }
      // fallback no image no special style
      return `
        <a href="${article.link}" role="article" tabindex="0" class="${cardClasses}" data-title="${article.title}" data-category="${article.category}" data-description="${article.description}">
          <span class="category-label">${article.category}</span>
          <h3>${article.title}</h3>
          <p>${article.description}</p>
        </a>
      `;
    }

    // Render cards for current page
    function renderCards() {
      cardsContainer.innerHTML = "";
      const start = (currentPage - 1) * cardsPerPage;
      const end = start + cardsPerPage;
      const pageArticles = filteredArticles.slice(start, end);
      if (pageArticles.length === 0) {
        cardsContainer.innerHTML = '<p class="text-center text-sm text-gray-500">No articles found.</p>';
        return;
      }
      pageArticles.forEach((article, idx) => {
        cardsContainer.insertAdjacentHTML("beforeend", createCard(article, idx));
      });
      // After rendering, observe cards for fade in/out
      observeCards();
      updatePaginationButtons();
    }

    // Pagination buttons update
    function updatePaginationButtons() {
      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage === Math.ceil(filteredArticles.length / cardsPerPage);
      renderPaginationNumbers();
    }

    // Render pagination numbers
    function renderPaginationNumbers() {
      paginationNumbers.innerHTML = "";
      const totalPages = Math.ceil(filteredArticles.length / cardsPerPage);
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = `px-3 py-1 rounded text-xs ${i === currentPage ? "bg-[#2563eb] text-white" : "bg-[#0f172a] text-white hover:bg-[#2563eb]"}`;
        btn.setAttribute("aria-label", `Page ${i}`);
        btn.addEventListener("click", () => {
          if (currentPage !== i) {
            currentPage = i;
            renderCards();
            window.scrollTo({top: 0, behavior: "smooth"});
          }
        });
        paginationNumbers.appendChild(btn);
      }
    }

    // Filter articles based on search query
    function filterArticles(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        filteredArticles = articles;
      } else {
        filteredArticles = articles.filter(article => {
          return (
            article.title.toLowerCase().includes(q) ||
            article.category.toLowerCase().includes(q) ||
            article.description.toLowerCase().includes(q)
          );
        });
      }
      currentPage = 1;
      renderCards();
    }

    // Intersection Observer for fade in/out on scroll
    let observer;
    function observeCards() {
      if (observer) {
        observer.disconnect();
      }
      const cards = Array.from(document.querySelectorAll(".card"));
      const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.1
      };
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          } else {
            entry.target.classList.remove("visible");
          }
        });
      }, observerOptions);
      cards.forEach(card => {
        observer.observe(card);
      });
    }

    // Event listeners
    searchInput.addEventListener("input", e => {
      filterArticles(e.target.value);
    });

    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderCards();
        window.scrollTo({top: 0, behavior: "smooth"});
      }
    });

    nextPageBtn.addEventListener("click", () => {
      if (currentPage < Math.ceil(filteredArticles.length / cardsPerPage)) {
        currentPage++;
        renderCards();
        window.scrollTo({top: 0, behavior: "smooth"});
      }
    });

    // Initial render
    renderCards();

    // Re-render cards on window resize to update grid spans
    window.addEventListener("resize", () => {
      renderCards();
    });
  })();
  


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



// nav bar automation
// window.addEventListener("scroll", navScroll);
// function navScroll() {
//   let scrolled = false;
//   let nav = document.querySelector('nav');
//   if (window.pageYOffset > 100) {
//     nav.style.position = 'fixed';
//     nav.style.width = '100%';
//     if (!scrolled) {
//       nav.style.transform = 'translateY(-100px)'
//     }
//     setTimeout(() => {
//       nav.style.transform = 'translateY(0)';
//     }, 1000);
//   } else {
//     nav.style.position = 'static';
//     scrolled = false;
//   }
// }

