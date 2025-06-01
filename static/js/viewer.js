// viewer.js

window.onload = function () {
    const params = getQueryParams();
    const entityType = params['entity']; // 'book', 'author', 'publisher', or 'genre'
    const id = params['id'];

    if (entityType && id) {
        displayEntity(entityType, id);
    } else {
        document.getElementById('content').innerHTML = '<p>Invalid parameters.</p>';
    }
};

/**
 * Function to retrieve query parameters from the URL.
 * @returns {Object} An object containing key-value pairs of query parameters.
 */
function getQueryParams() {
    const params = {};
    window.location.search.substring(1).split("&").forEach(pair => {
        const [key, value] = pair.split("=");
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
    });
    return params;
}

/**
 * Fetches a description from the Gemini API for the given entity.
 * @param {string} entityName - The name of the entity (book, author, genre, etc.).
 */
async function fetchGeminiDescription(entityName) {
    console.log('Fetching description for:', entityName);
    try {
        const response = await fetch(`/api/description?name=${encodeURIComponent(entityName)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 400) {
            throw new Error('Invalid request. Entity name is missing.');
        } else if (response.status === 500) {
            throw new Error('Server error while fetching description.');
        } else if (!response.ok) {
            throw new Error('Unexpected error occurred.');
        }

        const data = await response.json();
        const descriptionMarkdown = data.description || 'No description available.';

        // Convert Markdown to HTML using Marked.js
        const descriptionHTML = marked.parse(descriptionMarkdown);

        // Display the description in the "description" div
        document.getElementById('description').innerHTML = `<h2>Description</h2>${descriptionHTML}`;
    } catch (error) {
        console.error('Error fetching description from Gemini API:', error);
        document.getElementById('description').innerHTML = `<p>${error.message}</p>`;
    }
}

/**
 * Fetches entity details from the backend API
 * @param {string} entityType - The type of entity ('book', 'author', 'publisher', 'genre')
 * @param {string} id - The ID of the entity
 */
async function fetchEntity(entityType, id) {
    try {
        const response = await fetch(`/api/${entityType}s/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${entityType}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${entityType}:`, error);
        throw error;
    }
}

/**
 * Displays the details of a specific entity
 * @param {string} entityType - The type of entity ('book', 'author', 'publisher', 'genre')
 * @param {string} id - The ID of the entity to display
 */
async function displayEntity(entityType, id) {
    try {
        // Fetch entity details from the API
        const entity = await fetchEntity(entityType, id);
        if (!entity) {
            document.getElementById('content').innerHTML = '<p>Entity not found.</p>';
            return;
        }

        // Build the HTML content
        let htmlContent = `<h1>${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Details</h1><ul>`;

        // Display common fields
        if (entity.name || entity.title) {
            htmlContent += `<li><strong>Name:</strong> ${entity.name || entity.title}</li>`;
        }

        // Display entity-specific fields
        switch (entityType) {
            case 'book':
                htmlContent += `
                    <li><strong>Author:</strong> <a href="viewer.html?entity=author&id=${entity.author_id}" target="_blank">${entity.author}</a></li>
                    <li><strong>Publisher:</strong> <a href="viewer.html?entity=publisher&id=${entity.publisher_id}" target="_blank">${entity.publisher}</a></li>
                    <li><strong>Genre:</strong> <a href="viewer.html?entity=genre&id=${entity.genre_id}" target="_blank">${entity.genre}</a></li>
                    <li><strong>Status:</strong> ${entity.status}</li>
                `;
                
                // Display borrowing details if book is borrowed
                if (entity.status === 'Borrowed' && entity.borrow_records) {
                    const activeBorrow = entity.borrow_records.find(r => !r.actual_return_date);
                    if (activeBorrow) {
                        htmlContent += `<h2>Borrowing Details</h2><ul>
                            <li><strong>Borrower:</strong> ${activeBorrow.borrower_name}</li>
                            <li><strong>Borrow Date:</strong> ${activeBorrow.borrow_date}</li>
                            <li><strong>Return Date:</strong> ${activeBorrow.return_date}</li>
                        </ul>`;
                    }
                }
                break;
                
            case 'author':
                if (entity.books && entity.books.length > 0) {
                    htmlContent += `<li><strong>Books:</strong><ul>`;
                    entity.books.forEach(book => {
                        htmlContent += `<li><a href="viewer.html?entity=book&id=${book.id}" target="_blank">${book.title}</a></li>`;
                    });
                    htmlContent += `</ul></li>`;
                }
                break;
                
            case 'publisher':
                if (entity.books && entity.books.length > 0) {
                    htmlContent += `<li><strong>Books:</strong><ul>`;
                    entity.books.forEach(book => {
                        htmlContent += `<li><a href="viewer.html?entity=book&id=${book.id}" target="_blank">${book.title}</a></li>`;
                    });
                    htmlContent += `</ul></li>`;
                }
                break;
                
            case 'genre':
                if (entity.books && entity.books.length > 0) {
                    htmlContent += `<li><strong>Books:</strong><ul>`;
                    entity.books.forEach(book => {
                        htmlContent += `<li><a href="viewer.html?entity=book&id=${book.id}" target="_blank">${book.title}</a></li>`;
                    });
                    htmlContent += `</ul></li>`;
                }
                break;
        }

        htmlContent += '</ul>';
        htmlContent += `<a href="/" class="back-link">&larr; Back to Catalog</a>`;

        // Display the content
        document.getElementById('content').innerHTML = htmlContent;

        // Fetch and display the Gemini description
        if (entity.name || entity.title) {
            fetchGeminiDescription(entity.name || entity.title);
        }

    } catch (error) {
        console.error('Error displaying entity:', error);
        document.getElementById('content').innerHTML = `<p>Error loading entity details: ${error.message}</p>`;
    }
}