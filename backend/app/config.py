import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY                    = os.getenv("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI       = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS     = {
        "pool_pre_ping": True,
        "pool_recycle":  300,
        "connect_args": {
            "sslmode": "prefer",
            "connect_timeout": 10
        }
    }
    JWT_SECRET_KEY                = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES      = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 24))
    )
    CORS_ORIGINS                  = os.getenv("FRONTEND_URL", "http://localhost:5173")
