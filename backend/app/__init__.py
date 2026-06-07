from flask import Flask
from .config import Config
from .extensions import db, jwt, bcrypt, cors

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialise extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Register blueprints
    from .routes.auth        import auth_bp
    from .routes.students    import students_bp
    from .routes.preferences import preferences_bp
    from .routes.admin       import admin_bp

    app.register_blueprint(auth_bp,        url_prefix="/api/auth")
    app.register_blueprint(students_bp,    url_prefix="/api/students")
    app.register_blueprint(preferences_bp, url_prefix="/api/preferences")
    app.register_blueprint(admin_bp,       url_prefix="/api/admin")

    return app
