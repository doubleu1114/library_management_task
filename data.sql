-- Clear existing tables (if needed)
-- TRUNCATE TABLE authors, publishers, genres, books, borrow_records RESTART IDENTITY CASCADE;

-- Insert authors
INSERT INTO authors (id, name) VALUES
(1, 'George Orwell'),
(2, 'Harper Lee'),
(3, 'Jane Austen'),
(4, 'Francesc Miralles and Hector Garcia');

-- Insert publishers
INSERT INTO publishers (id, name) VALUES
(1, 'Penguin Books'),
(2, 'J.B. Lippincott & Co.'),
(3, 'T. Egerton'),
(4, 'Secker and Warburg'),
(5, 'Penguin Life');

-- Insert genres
INSERT INTO genres (id, name) VALUES
(1, 'Fiction'),
(2, 'Non-Fiction'),
(3, 'Romance'),
(4, 'Satire'),
(5, 'Self Help');

-- Insert books
INSERT INTO books (id, title, author_id, publisher_id, genre_id) VALUES
(1, '1984', 1, 1, 1),
(2, 'To Kill a Mockingbird', 2, 2, 1),
(3, 'Pride and Prejudice', 3, 3, 3),
(4, 'Animal Farm', 1, 4, 4),
(5, 'Ikigai', 4, 5, 5);