# Contributing to MTG Deck Optimizer 🤝

Thank you for your interest in contributing! This project is designed to be welcoming to developers of all skill levels.

## 🚀 Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies: `pip install -r requirements.txt`
4. **Test** the app: `python src/demo.py`
5. **Run** locally: `cd src && python app.py`

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Use the issue template
- Include steps to reproduce
- Mention your environment (OS, Python version)

### ✨ Feature Requests
- Check the [roadmap](docs/ROADMAP.md) first
- Describe the use case clearly
- Consider offering to implement it!

### 💻 Code Contributions
Perfect for:
- **Beginners**: Documentation, UI improvements, test cases
- **Intermediate**: New export formats, deck analysis features
- **Advanced**: EDHREC integration, performance optimization

## 🏗️ Development Guidelines

### Code Style
- Follow PEP 8 for Python code
- Use meaningful variable names
- Add docstrings for new functions
- Keep functions focused and small

### Testing
- Run `python src/demo.py` before submitting
- Test with different collection sizes
- Verify all export formats work

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add: brief description of changes"

# Push and create PR
git push origin feature/your-feature-name
```

## 📋 Good First Issues

Perfect starting points:
- [ ] Add new export formats (CSV, Excel)
- [ ] Improve error messages and validation
- [ ] Add card images to the UI
- [ ] Create additional deck statistics
- [ ] Write more comprehensive tests

## 🧪 Local Development

### Project Structure
```
src/
├── app.py          # Flask routes and web logic
├── utils.py        # Data loading utilities  
├── deckgen.py      # Core deck building algorithms
├── deck_export.py  # Export functionality
└── templates/      # HTML templates
```

### Adding New Features
1. **Backend**: Add functions to appropriate module
2. **Frontend**: Update templates as needed
3. **Routes**: Add Flask routes in app.py
4. **Test**: Verify with demo.py

### Common Development Tasks

**Add a new export format:**
```python
# In deck_export.py
def export_deck_to_new_format(deck_data):
    # Implementation here
    pass

# In app.py  
@app.route("/export-new-format")
def export_new_format():
    # Route implementation
    pass
```

**Add deck analysis feature:**
```python
# In deck_export.py or new analysis.py
def analyze_new_metric(deck_data):
    # Analysis logic here
    return analysis_result
```

## 🎨 UI/UX Guidelines

- **Mobile-first**: Design works on all screen sizes
- **Magic Theme**: Use MTG-appropriate colors and styling
- **Accessibility**: Consider screen readers and keyboard navigation
- **Performance**: Keep page loads fast

## 📖 Documentation

When adding features:
- Update docstrings
- Add usage examples
- Update README if needed
- Consider adding to demo.py

## 🎉 Recognition

Contributors will be:
- Listed in the README acknowledgments
- Mentioned in release notes
- Invited to help shape future direction

---

**Ready to contribute? Check out our [good first issues](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and jump in!**
