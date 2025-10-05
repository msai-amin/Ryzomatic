# 📁 Archive Directory

This directory contains archived files, old versions, and unused code that has been moved out of the main codebase for better organization.

## 📂 Directory Structure

### `docs/`
Contains archived documentation files:
- AI Engine documentation
- Architecture comparisons
- Deployment guides
- Debug guides
- Implementation guides
- OAuth setup guides
- PDF troubleshooting guides
- TTS guides

### `services/`
Contains old service implementations:
- AI integration services
- API gateway
- Chat API
- Document processing
- File storage
- Vector database
- Vector DB (Python)

### `debug/`
Contains debug and test files:
- Debug HTML files
- Test files
- Sample documents
- OAuth test utilities

### `old-versions/`
Contains old versions and backups:
- Docker configurations
- Nginx configs
- Makefiles
- S3 configurations
- Backup files
- Old worker files

## 🎯 Purpose

This archive serves as:
- **Historical Reference**: Keep old implementations for reference
- **Rollback Safety**: Ability to restore previous versions if needed
- **Clean Codebase**: Keep main directory focused on current code
- **Documentation**: Preserve development history and decisions

## 📋 Usage

### Viewing Archived Files
```bash
# List all archived docs
ls archive/docs/

# View specific archived file
cat archive/docs/AI_ENGINE_IMPLEMENTATION_SUMMARY.md

# Search archived content
grep -r "keyword" archive/
```

### Restoring Files
```bash
# Restore a specific file
cp archive/docs/filename.md ./

# Restore entire directory
cp -r archive/services/ai-integration/ ./
```

### Adding to Archive
```bash
# Archive a file
mv old-file.md archive/docs/

# Archive a directory
mv old-directory/ archive/old-versions/
```

## ⚠️ Important Notes

- **Do not delete** archived files without careful consideration
- **Document** any files moved to archive with commit messages
- **Keep archive organized** by category and purpose
- **Archive regularly** to maintain clean codebase

## 🔄 Maintenance

### Regular Cleanup
- Review archive quarterly
- Remove truly obsolete files
- Reorganize if structure becomes messy
- Update this README when adding new categories

### Best Practices
- Use descriptive filenames
- Add context in commit messages
- Keep related files together
- Document restoration procedures

---

**Last Updated**: January 2025
**Total Files**: 171
**Total Size**: 4.3M
