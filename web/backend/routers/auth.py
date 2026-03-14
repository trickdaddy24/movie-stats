from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field
import database as db
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Request/Response models
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: int
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Endpoints
@router.post("/register", response_model=AuthResponse)
def register(request: RegisterRequest):
    """Register a new user."""
    # Check if username already exists
    existing = db.get_user_by_username(request.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Create user
    hashed = hash_password(request.password)
    user = db.create_user(request.username, request.email, hashed)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    # Create JWT token
    token = create_access_token({"sub": str(user["id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(**user),
    }


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest):
    """Login with username and password."""
    user = db.get_user_by_username(request.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Verify password
    if not verify_password(request.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Create JWT token
    token = create_access_token({"sub": str(user["id"])})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(**user),
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(**current_user)
