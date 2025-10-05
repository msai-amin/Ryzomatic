#!/bin/bash

# Script to create independent serverless repository from refactor branch
# This script helps you create a new independent repo without affecting the original

set -e  # Exit on error

echo "========================================="
echo "Smart Reader - Create Serverless Repo"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Not in smart-reader directory${NC}"
    exit 1
fi

# Check if on refactor branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "refactor/claude-native-serverless" ]; then
    echo -e "${YELLOW}Switching to refactor/claude-native-serverless branch...${NC}"
    git checkout refactor/claude-native-serverless
fi

# Get GitHub username
echo -e "${YELLOW}Enter your GitHub username:${NC}"
read -r GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}Error: GitHub username is required${NC}"
    exit 1
fi

# Confirm repo name
REPO_NAME="smart-reader-serverless"
echo -e "${YELLOW}New repository name will be: ${GREEN}${REPO_NAME}${NC}"
echo -e "${YELLOW}Full URL: ${GREEN}https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
echo ""
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

# Step 1: Check if remote already exists
echo ""
echo -e "${GREEN}Step 1: Checking for existing remote...${NC}"
if git remote get-url serverless &> /dev/null; then
    echo -e "${YELLOW}Remote 'serverless' already exists. Removing...${NC}"
    git remote remove serverless
fi

# Step 2: Add new remote
echo ""
echo -e "${GREEN}Step 2: Adding new remote...${NC}"
git remote add serverless "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
echo -e "${GREEN}✓ Remote added${NC}"

# Step 3: Verify everything is committed
echo ""
echo -e "${GREEN}Step 3: Checking for uncommitted changes...${NC}"
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Warning: You have uncommitted changes.${NC}"
    echo -e "${YELLOW}Commit them first? (y/n)${NC}"
    read -r COMMIT_CONFIRM
    
    if [ "$COMMIT_CONFIRM" = "y" ]; then
        git add .
        echo -e "${YELLOW}Enter commit message:${NC}"
        read -r COMMIT_MSG
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✓ Changes committed${NC}"
    else
        echo -e "${RED}Please commit your changes first.${NC}"
        exit 1
    fi
fi

# Step 4: Push to new repo
echo ""
echo -e "${GREEN}Step 4: Creating new repository on GitHub...${NC}"
echo -e "${YELLOW}Please create the repository manually at:${NC}"
echo -e "${GREEN}https://github.com/new${NC}"
echo ""
echo "Repository settings:"
echo "  - Name: ${REPO_NAME}"
echo "  - Description: Cloud-native serverless version with Gemini AI"
echo "  - Private or Public: (your choice)"
echo "  - Do NOT initialize with README, .gitignore, or license"
echo ""
echo -e "${YELLOW}Press Enter when you've created the repository...${NC}"
read -r

# Step 5: Push the branch
echo ""
echo -e "${GREEN}Step 5: Pushing refactor branch to new repo...${NC}"
git push serverless refactor/claude-native-serverless:main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully pushed to new repository!${NC}"
else
    echo -e "${RED}Error: Failed to push. Did you create the repository on GitHub?${NC}"
    exit 1
fi

# Step 6: Instructions for cloning separately
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ New repository created successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your new independent repository is at:"
echo -e "${GREEN}https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
echo ""
echo "To work on it separately, run:"
echo ""
echo -e "${YELLOW}cd ~/projects${NC}  # or your preferred location"
echo -e "${YELLOW}git clone https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git${NC}"
echo -e "${YELLOW}cd ${REPO_NAME}${NC}"
echo ""
echo "Your original repository at:"
echo -e "${GREEN}$(pwd)${NC}"
echo "remains completely untouched!"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Clone the new repo separately (commands above)"
echo "2. Update README.md in new repo"
echo "3. Update package.json with new repo URL"
echo "4. Deploy to Vercel"
echo "5. Start development!"
echo ""
echo -e "${YELLOW}See CREATE_INDEPENDENT_REPO.md for detailed next steps.${NC}"

