from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import configparser
import requests
import logging
from datetime import datetime, timedelta

app = Flask(__name__, static_url_path='/static', static_folder='static')
CORS(app)

# Configure logging to DEBUG level for detailed logs
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load the configuration from the config.ini file
config = configparser.ConfigParser()
config.read('config.ini')

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://admin:root@localhost:5432/test_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Get the API key and URL from the configuration
try:
    GEMINI_API_KEY = config.get('API', 'GEMINI_API_KEY')
    GEMINI_API_URL = config.get('API', 'GEMINI_API_URL')
    logging.info("Gemini API configuration loaded successfully.")
except Exception as e:
    logging.error("Error reading config.ini: %s", e)
    GEMINI_API_KEY = None
    GEMINI_API_URL = None

# Database Models
class Author(db.Model):
    __tablename__ = 'authors'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    books = db.relationship('Book', backref='author', lazy=True)

class Publisher(db.Model):
    __tablename__ = 'publishers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    books = db.relationship('Book', backref='publisher', lazy=True)

class Genre(db.Model):
    __tablename__ = 'genres'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    books = db.relationship('Book', backref='genre', lazy=True)

class Book(db.Model):
    __tablename__ = 'books'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('authors.id'), nullable=False)
    publisher_id = db.Column(db.Integer, db.ForeignKey('publishers.id'), nullable=False)
    genre_id = db.Column(db.Integer, db.ForeignKey('genres.id'), nullable=False)

class BorrowRecord(db.Model):
    __tablename__ = 'borrow_records'
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    borrower_name = db.Column(db.String(100), nullable=False)
    borrow_date = db.Column(db.Date, nullable=False)
    return_date = db.Column(db.Date, nullable=False)
    actual_return_date = db.Column(db.Date)
    book = db.relationship('Book', backref='borrow_records')

# Database initialization
def initialize_database():
    with app.app_context():
        db.create_all()

# Call this when starting the application
initialize_database()

# Route to serve the home page
@app.route('/')
def home():
    return render_template('index.html')

# Route to serve viewer.html
@app.route('/viewer.html')
def viewer():
    return render_template('viewer.html')

# API route to fetch all books
@app.route('/api/books', methods=['GET'])
def get_books():
    try:
        books = Book.query.all()
        books_data = []
        for book in books:
            # Get active borrow record (if exists)
            active_borrow = BorrowRecord.query.filter_by(
                book_id=book.id,
                actual_return_date=None
            ).first()
            
            is_borrowed = active_borrow is not None
            
            # Prepare base book data
            book_data = {
                'id': book.id,
                'title': book.title,
                'author': book.author.name,
                'author_id': book.author.id,
                'publisher': book.publisher.name,
                'publisher_id': book.publisher.id,
                'genre': book.genre.name,
                'genre_id': book.genre.id,
                'status': 'Borrowed' if is_borrowed else 'Available',
                'borrowerName': '',
                'borrowDate': '',
                'returnDate': ''
            }
            
            # If borrowed, add borrowing details
            if is_borrowed:
                book_data.update({
                    'borrowerName': active_borrow.borrower_name,
                    'borrowDate': active_borrow.borrow_date.isoformat() if active_borrow.borrow_date else '',
                    'returnDate': active_borrow.return_date.isoformat() if active_borrow.return_date else ''
                })
            
            books_data.append(book_data)
            
        return jsonify(books_data)
    except Exception as e:
        logging.error(f"Error fetching books: {e}")
        return jsonify({'error': 'Failed to fetch books'}), 500

# API route to borrow a book
@app.route('/api/borrow', methods=['POST'])
def borrow_book():
    try:
        data = request.get_json()
        book_id = data.get('book_id')
        borrower_name = data.get('borrower_name')
        borrow_date = datetime.strptime(data.get('borrow_date'), '%Y-%m-%d').date()
        return_date = borrow_date + timedelta(days=90)  # 3 months later

        # Check if book exists
        book = Book.query.get(book_id)
        if not book:
            return jsonify({'error': 'Book not found'}), 404

        # Check if book is already borrowed
        existing_borrow = BorrowRecord.query.filter_by(
            book_id=book_id,
            actual_return_date=None
        ).first()
        if existing_borrow:
            return jsonify({'error': 'Book is already borrowed'}), 400

        new_record = BorrowRecord(
            book_id=book_id,
            borrower_name=borrower_name,
            borrow_date=borrow_date,
            return_date=return_date
        )
        
        db.session.add(new_record)
        db.session.commit()
        
        return jsonify({'message': 'Book borrowed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error borrowing book: {e}")
        return jsonify({'error': 'Failed to borrow book'}), 500

# API route to return a book
@app.route('/api/return', methods=['POST'])
def return_book():
    try:
        data = request.get_json()
        book_id = data.get('book_id')
        return_date = datetime.strptime(data.get('return_date'), '%Y-%m-%d').date()

        # Find active borrowing record
        record = BorrowRecord.query.filter_by(
            book_id=book_id,
            actual_return_date=None
        ).first()

        if not record:
            return jsonify({'error': 'No active borrowing record found'}), 404

        record.actual_return_date = return_date
        db.session.commit()
        
        return jsonify({'message': 'Book returned successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error returning book: {e}")
        return jsonify({'error': 'Failed to return book'}), 500

@app.route('/api/clear-borrow-records', methods=['POST'])
def clear_borrow_records():
    try:
        # Delete all borrow records
        num_deleted = db.session.query(BorrowRecord).delete()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully cleared {num_deleted} borrow records'
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error clearing borrow records: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/books/<int:book_id>')
def get_book(book_id):
    book = Book.query.get_or_404(book_id)
    return jsonify({
        'id': book.id,
        'title': book.title,
        'author': book.author.name,
        'author_id': book.author.id,
        'publisher': book.publisher.name,
        'publisher_id': book.publisher.id,
        'genre': book.genre.name,
        'genre_id': book.genre.id,
        'status': 'Borrowed' if any(r.actual_return_date is None for r in book.borrow_records) else 'Available',
        'borrow_records': [{
            'borrower_name': r.borrower_name,
            'borrow_date': r.borrow_date.isoformat(),
            'return_date': r.return_date.isoformat(),
            'actual_return_date': r.actual_return_date.isoformat() if r.actual_return_date else None
        } for r in book.borrow_records]
    })

@app.route('/api/authors/<int:author_id>')
def get_author(author_id):
    author = Author.query.get_or_404(author_id)
    return jsonify({
        'id': author.id,
        'name': author.name,
        'books': [{
            'id': b.id,
            'title': b.title
        } for b in author.books]
    })

@app.route('/api/publishers/<int:publisher_id>')
def get_publisher(publisher_id):
    publisher = Publisher.query.get_or_404(publisher_id)
    return jsonify({
        'id': publisher.id,
        'name': publisher.name,
        'books': [{
            'id': b.id,
            'title': b.title
        } for b in publisher.books]
    })

@app.route('/api/genres/<int:genre_id>')
def get_genre(genre_id):
    genre = Genre.query.get_or_404(genre_id)
    return jsonify({
        'id': genre.id,
        'name': genre.name,
        'books': [{
            'id': b.id,
            'title': b.title
        } for b in genre.books]
    })

# API route to fetch description from Gemini API (unchanged)
@app.route('/api/description', methods=['GET'])
def get_description():
    entity_name = request.args.get('name')
    logging.debug(f"Received request for entity name: {entity_name}")

    if not entity_name:
        logging.warning("Missing entity name in request.")
        return jsonify({'error': 'Missing entity name'}), 400

    if not GEMINI_API_URL or not GEMINI_API_KEY:
        logging.error("Gemini API configuration missing.")
        return jsonify({'error': 'Server configuration error'}), 500

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            f"Provide a detailed description of '{entity_name}'"
                            "If it is a book include information about the setting, characters, themes, key concepts, and its influence. "
                            "Do not include any concluding remarks or questions."
                            "Do not mention any Note at the end about not including concluding remarks or questions."
                        )
                    }
                ]
            }
        ]
    }

    api_url_with_key = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(
            api_url_with_key,
            headers=headers,
            json=payload,
            timeout=10
        )

        if response.status_code != 200:
            logging.error(f"Failed to fetch description from Gemini API. Status code: {response.status_code}")
            return jsonify({
                'error': 'Failed to fetch description from Gemini API',
                'status_code': response.status_code,
                'response': response.text
            }), 500

        response_data = response.json()
        description = response_data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', 'No description available.')
        
        return jsonify({'description': description})

    except requests.exceptions.RequestException as e:
        logging.error(f"Exception during Gemini API request: {e}")
        return jsonify({'error': 'Failed to connect to Gemini API', 'message': str(e)}), 500
    except Exception as e:
        logging.exception(f"Unexpected error: {e}")
        return jsonify({'error': 'An unexpected error occurred', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)