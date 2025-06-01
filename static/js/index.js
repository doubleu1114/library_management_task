window.onload = function () {
    fetchBooks();
};

/**
 * Fetches books from the API and updates the UI
 */
function fetchBooks() {
    fetch('/api/books')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(books => {
            updateBookTable(books);
            updateBorrowDropdowns(books);
        })
        .catch(error => {
            console.error('Error fetching books:', error);
            alert('Failed to load books. Please try again later.');
        });
}

/**
 * Updates the book table with fetched data
 * @param {Array} books - Array of book objects
 */
function updateBookTable(books) {
    const bookTable = document.getElementById('book-table');
    bookTable.innerHTML = '';

    books.forEach(book => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', book.id);
        
        // // Find active borrow record if book is borrowed
        const activeBorrow = book.status === 'Borrowed'; 
            // ? book.borrow_records?.find(r => !r.actual_return_date)
            // : null;

        row.innerHTML = `
            <td>${book.id}</td>
            <td><a href="viewer.html?entity=book&id=${book.id}">${book.title}</a></td>
            <td><a href="viewer.html?entity=author&id=${book.author_id}">${book.author}</a></td>
            <td><a href="viewer.html?entity=publisher&id=${book.publisher_id}">${book.publisher}</a></td>
            <td><a href="viewer.html?entity=genre&id=${book.genre_id}">${book.genre}</a></td>
            <td>${activeBorrow? book.borrowerName : ''}</td>
            <td>${activeBorrow? book.borrowDate : ''}</td>
            <td>${activeBorrow? book.returnDate : ''}</td>
            <td>${book.status}</td>
        `;
        bookTable.appendChild(row);
    });
}

/**
 * Updates the borrow and return dropdowns
 * @param {Array} books - Array of book objects
 */
function updateBorrowDropdowns(books) {
    const borrowBookSelect = document.getElementById('borrowBookId');
    const returnBookSelect = document.getElementById('returnBookId');

    // Clear existing options
    borrowBookSelect.innerHTML = '<option value="">Select a Book</option>';
    returnBookSelect.innerHTML = '<option value="">Select a Book</option>';

    books.forEach(book => {
        const option = document.createElement('option');
        option.value = book.id;
        option.textContent = `${book.id} - ${book.title}`;

        if (book.status === 'Borrowed') {
            returnBookSelect.appendChild(option);
        } else {
            borrowBookSelect.appendChild(option);
        }
    });
}

/**
 * Handles the borrow form submission
 */
document.getElementById('borrowForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const bookId = document.getElementById('borrowBookId').value;
    const borrowerName = document.getElementById('borrowerName').value.trim();
    const borrowDate = document.getElementById('borrowDate').value;

    if (!validateBorrowForm(bookId, borrowerName, borrowDate)) {
        return;
    }

    borrowBook(bookId, borrowerName, borrowDate);
});

/**
 * Validates the borrow form inputs
 */
function validateBorrowForm(bookId, borrowerName, borrowDate) {
    if (!bookId || !borrowerName || !borrowDate) {
        alert('Please fill in all fields.');
        return false;
    }
    return true;
}

/**
 * Sends borrow request to the API
 */
function borrowBook(bookId, borrowerName, borrowDate) {
    if (!confirm(`Are you sure you want to borrow Book ID ${bookId}?`)) {
        return;
    }

    fetch('/api/borrow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            book_id: bookId,
            borrower_name: borrowerName,
            borrow_date: borrowDate
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Failed to borrow book'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Book borrowed successfully');
        fetchBooks(); // Refresh the book list
        document.getElementById('borrowForm').reset();
    })
    .catch(error => {
        console.error('Error:', error);
        alert(error.message || 'An error occurred while borrowing the book');
    });
}

/**
 * Handles the return form submission
 */
document.getElementById('returnForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const bookId = document.getElementById('returnBookId').value;
    const returnDate = document.getElementById('returnDate').value;

    if (!validateReturnForm(bookId, returnDate)) {
        return;
    }

    returnBook(bookId, returnDate);
});

/**
 * Validates the return form inputs
 */
function validateReturnForm(bookId, returnDate) {
    if (!bookId || !returnDate) {
        alert('Please fill in all fields.');
        return false;
    }
    return true;
}

/**
 * Sends return request to the API
 */
function returnBook(bookId, returnDate) {
    if (!confirm(`Are you sure you want to return Book ID ${bookId}?`)) {
        return;
    }

    fetch('/api/return', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            book_id: bookId,
            return_date: returnDate
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Failed to return book'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Book returned successfully');
        fetchBooks(); // Refresh the book list
        document.getElementById('returnForm').reset();
    })
    .catch(error => {
        console.error('Error:', error);
        alert(error.message || 'An error occurred while returning the book');
    });
}

/**
 * Clears all borrowing data
 */
document.getElementById('clearDataBtn').addEventListener('click', function () {
    if (!confirm('Are you sure you want to clear all borrowing data? This action cannot be undone.')) {
        return;
    }

    fetch('/api/clear-borrow-records', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Failed to clear records'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'All borrowing records cleared successfully');
        location.reload();
    })
    .catch(error => {
        console.error('Error:', error);
        alert(error.message || 'Failed to clear borrowing records');
    });
});