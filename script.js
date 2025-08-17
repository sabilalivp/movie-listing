// Assuming this is defined globally
const apiKey = '1311d6873719998c3cc5f8cfad531d84';
let currentLanguage = null;
let allMovies = []; // Single declaration
const manualMovies = [
    { title: "Drishyam 2", release_date: "2021-02-19", ott: "Amazon Prime", rating: 8.4, poster_path: "/eW9oQikv0e8e1UIB5J6e8cQ5k2r.jpg", original_language: "ml" }
];

let currentPage = 1;
let totalPages = 1;
let totalResults = 0; // Add to store total results globally
let showOttOnly = false; // Toggle state for OTT-only filter
let showAllLanguages = true; // Toggle state for language filter

async function fetchMovies(language, page = 1) {
    const movieList = document.getElementById('movie-list');
    if (!movieList) {
        console.error('movie-list element not found. Please ensure a <div id="movie-list"> exists in your HTML.');
        return;
    }
    movieList.innerHTML = '<p>Loading movies...</p>';

    try {
        // Fetch the first page to get total results if not already fetched
        if (page === 1) {
            const firstResponse = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_original_language=${language}&sort_by=primary_release_date.desc&page=1`);
            if (!firstResponse.ok) throw new Error(`HTTP error! status: ${firstResponse.status}`);
            const firstData = await firstResponse.json();
            console.log(`First response for ${language}:`, firstData);
            totalResults = firstData.total_results;
            totalPages = Math.ceil(totalResults / 40) || 1; // 40 movies per page (2 pages of 20)
            console.log(`Total pages for ${language}: ${totalPages}, Total results: ${totalResults}`);
            allMovies = []; // Reset movies on new language or page 1
        }

        // Fetch multiple pages to approximate 40 movies per "page"
        const moviesPerPage = 40;
        const startPage = (Math.floor((page - 1) * (moviesPerPage / 20)) + 1); // Calculate starting API page
        const endPage = Math.min(startPage + 1, Math.ceil(totalResults / 20)); // Fetch 2 pages
        const fetchedMovies = [];

        for (let p = startPage; p <= endPage; p++) {
            console.log(`Fetching page ${p} for ${language}`);
            const response = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_original_language=${language}&sort_by=primary_release_date.desc&page=${p}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} on page ${p}`);
            const data = await response.json();
            console.log(`Page ${p} data for ${language}:`, data.results.length);
            fetchedMovies.push(...data.results);
        }

        allMovies = [...allMovies, ...fetchedMovies];

        // Add manual movies for the selected language (only on first page)
        if (page === 1) {
            allMovies = [...allMovies, ...manualMovies.filter(m => m.original_language === language)];
            console.log(`Total movies after manual add for ${language}:`, allMovies.length);
        }

        // Fetch OTT platforms concurrently for the current batch's movies
        const movieBatch = fetchedMovies;
        await Promise.all(movieBatch.map(async (movie, index) => {
            console.log(`Processing OTT for ${movie.title || 'Unnamed movie'} at index ${index} on page ${page}`);
            if (movie.id) {
                try {
                    const providersUrl = `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`;
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000); // 5-second timeout
                    const providersResponse = await fetch(providersUrl, { signal: controller.signal });
                    clearTimeout(timeout);
                    if (!providersResponse.ok) throw new Error(`Providers error! status: ${providersResponse.status}`);
                    const providersData = await providersResponse.json();
                    movie.otts = providersData.results?.IN?.flatrate?.map(p => p.provider_name).join(', ') || 'Not on OTT yet';
                } catch (providerError) {
                    console.error(`Error fetching providers for ${movie.title}:`, providerError);
                    movie.otts = 'Not on OTT yet';
                }
            } else {
                movie.otts = movie.ott || 'Not on OTT yet';
            }
        }));

        // Render the heading and current page's movies (40 per page)
        movieList.innerHTML = ''; // Clear existing content
        const headingContainer = document.createElement('div');
        headingContainer.style.textAlign = 'center'; // Center-align the container
        const heading = document.createElement('h1');
        heading.textContent = `${language === 'ml' ? 'Malayalam' : language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'Movies'} movies`;
        headingContainer.appendChild(heading);
        movieList.appendChild(headingContainer);

        const start = (page - 1) * moviesPerPage;
        const end = Math.min(start + moviesPerPage, allMovies.length);
        const currentPageMovies = showOttOnly 
            ? allMovies.slice(start, end).filter(movie => movie.otts && movie.otts !== 'Not on OTT yet')
            : allMovies.slice(start, end);

        if (currentPageMovies.length === 0) {
            movieList.innerHTML = '<p>No movies found.</p>';
            return;
        }

        for (let movie of currentPageMovies) {
            let otts = movie.otts || 'Not on OTT yet';
            const movieDiv = document.createElement('div');
            movieDiv.className = 'movie';
            movieDiv.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w200${movie.poster_path || 'https://via.placeholder.com/200x300'}" alt="${movie.title}">
                <h2>${movie.title}</h2>
                <p>Release: ${movie.release_date || 'Unknown'}</p>
                <p>OTT: ${otts}</p>
                <p>Rating: ${movie.rating || movie.vote_average || 0}/10</p>
            `;
            movieList.appendChild(movieDiv);
        }

        // Add or update pagination buttons
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        const maxButtons = 10; // Limit to 10 page buttons at a time
        const startPageNum = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        const endPageNum = Math.min(totalPages, startPageNum + maxButtons - 1);

        for (let i = startPageNum; i <= endPageNum; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = i === currentPage ? 'active' : '';
            pageButton.addEventListener('click', () => {
                currentPage = i;
                fetchMovies(language, currentPage);
            });
            pagination.appendChild(pageButton);
        }

        if (currentPage < totalPages) {
            const nextSpan = document.createElement('span');
            nextSpan.textContent = ' ...';
            pagination.appendChild(nextSpan);
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.addEventListener('click', () => {
                currentPage = Math.min(currentPage + 1, totalPages);
                fetchMovies(language, currentPage);
            });
            pagination.appendChild(nextButton);
        } else {
            pagination.innerHTML += `<div>Showing all ${allMovies.length} ${language === 'ml' ? 'Malayalam' : language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : ''} movies</div>`;
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
        movieList.innerHTML = '';
        const filteredManual = manualMovies.filter(m => m.original_language === language);
        if (filteredManual.length === 0) {
            movieList.innerHTML = '<p>No movies found.</p>';
        } else {
            console.log(`Rendering ${filteredManual.length} manual movies for ${language}`);
            const headingContainer = document.createElement('div');
            headingContainer.style.textAlign = 'center';
            const heading = document.createElement('h1');
            heading.textContent = `${language === 'ml' ? 'Malayalam' : language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'Movies'} movies`;
            headingContainer.appendChild(heading);
            movieList.appendChild(headingContainer);
            for (let movie of filteredManual) {
                const movieDiv = document.createElement('div');
                movieDiv.className = 'movie';
                movieDiv.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w200${movie.poster_path}" alt="${movie.title}">
                    <h2>${movie.title}</h2>
                    <p>Release: ${movie.release_date}</p>
                    <p>OTT: ${movie.ott}</p>
                    <p>Rating: ${movie.rating}/10</p>
                `;
                movieList.appendChild(movieDiv);
            }
        }
        document.getElementById('pagination').innerHTML = '';
    }
}

// Toggle button event listener for languages
const langToggleButton = document.getElementById('toggle-lang-btn');
langToggleButton.addEventListener('click', () => {
    showAllLanguages = !showAllLanguages;
    langToggleButton.classList.toggle('toggled', !showAllLanguages); // Toggle 'toggled' when hiding languages
    const languageButtons = document.querySelectorAll('.language-btn');
    languageButtons.forEach(button => {
        button.style.display = showAllLanguages ? 'inline-block' : 'none'; // Show all or hide all
    });
});

// Toggle button event listener for OTT
const ottToggleButton = document.getElementById('toggle-ott-btn');
ottToggleButton.addEventListener('click', () => {
    showOttOnly = !showOttOnly;
    ottToggleButton.classList.toggle('toggled', showOttOnly); // Toggle the 'toggled' class
    const language = currentLanguage; // Use the current language
    fetchMovies(language, currentPage); // Re-render with the current page
});

// Home button event listener
const homeButton = document.getElementById('home-btn');
homeButton.addEventListener('click', () => {
    document.getElementById('language-selection').style.display = 'block'; // Show language selection
    document.getElementById('movie-list').innerHTML = ''; // Clear movie list
    document.getElementById('pagination').innerHTML = ''; // Clear pagination
    currentLanguage = null; // Reset current language
    currentPage = 1; // Reset page
    allMovies = []; // Reset movies
    showOttOnly = false; // Reset OTT toggle
    ottToggleButton.classList.remove('toggled'); // Reset OTT button color
});

// Initial call with event listener
document.querySelectorAll('.language-btn').forEach(button => {
    button.addEventListener('click', () => {
        console.log(`Button clicked for language: ${button.getAttribute('data-language')}`);
        const language = button.getAttribute('data-language');
        currentLanguage = language;
        currentPage = 1;
        allMovies = []; // Reset movies on language change
        showOttOnly = false; // Reset toggle state
        ottToggleButton.classList.remove('toggled'); // Reset OTT button color
        document.getElementById('language-selection').style.display = 'none';
        fetchMovies(language, currentPage);
    });
});