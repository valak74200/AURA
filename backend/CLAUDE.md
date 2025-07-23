# Claude Development Rules for AURA Project

## 📋 Core Development Principles

### 🧪 Test-Driven Development (TDD)
**MANDATORY**: At each completed development stage, you MUST:

1. **Write/Update Tests First**
   - Create comprehensive tests for new functionality
   - Update existing tests when modifying features
   - Ensure all tests pass before considering task complete
   - Minimum 90% code coverage for critical components

2. **Test Execution**
   ```bash
   # Run relevant tests after each change
   pytest tests/test_api/test_sessions.py -v
   pytest tests/test_services/ -v
   pytest tests/ --cov=app --cov-report=html
   ```

3. **Test Categories Required**
   - Unit tests for individual functions
   - Integration tests for service interactions
   - API endpoint tests with real service calls
   - WebSocket connection and message tests
   - Multilingual functionality tests

### 📚 Documentation Updates
**MANDATORY**: After successful testing, you MUST:

1. **Update README.md**
   - Add new features to feature list
   - Update installation instructions if needed
   - Add new API endpoints with examples
   - Update architecture diagrams if changed

2. **Update API Documentation**
   - Ensure FastAPI auto-docs are complete
   - Add docstrings to all new functions
   - Update type hints and parameter descriptions

3. **Update Code Comments**
   - Add inline documentation for complex logic
   - Update existing comments if behavior changed
   - Ensure all public methods have proper docstrings

## 🌍 Multilingual Implementation Rules

### Language Support Standards
- **Primary Languages**: French (fr), English (en)
- **Default Language**: French (fr)
- **Extensible Design**: Easy addition of new languages

### Cultural Adaptation Requirements
- **Audio Analysis**: Language-specific voice metrics and thresholds
- **AI Coaching**: Culturally appropriate feedback styles
- **User Interface**: Localized messages and responses
- **Analytics**: Language-specific benchmarks and comparisons

### Implementation Phases
Each phase MUST be completed with tests and documentation before proceeding:

1. **Phase 1**: Core multilingual models and enums
2. **Phase 2**: Audio analysis adaptation per language
3. **Phase 3**: AI coaching cultural context
4. **Phase 4**: Real-time multilingual pipeline
5. **Phase 5**: Analytics and metrics per language

## 🔒 Security and Quality Rules

### Code Quality
- **Type Hints**: Mandatory for all function parameters and returns
- **Error Handling**: Comprehensive exception handling with custom exceptions
- **Logging**: Structured logging with contextual information
- **Performance**: Async/await best practices for all I/O operations

### Security Requirements
- **Authentication**: JWT tokens with proper validation
- **Input Validation**: Pydantic models for all API inputs
- **Sensitive Data**: Never log or expose API keys, passwords, or tokens
- **File Uploads**: Size limits, format validation, security scanning

### Database Rules
- **Migrations**: All schema changes must have proper migrations
- **Transactions**: Use database transactions for multi-step operations
- **Indexes**: Proper indexing for query performance
- **Backup**: Consider backup strategies for production data

## 🚀 Development Workflow

### Before Starting New Feature
1. Create todo list items for the feature
2. Analyze existing code for integration points
3. Plan test strategy for the feature
4. Identify documentation updates needed

### During Development
1. Write tests for each component as you build it
2. Run tests frequently to catch issues early
3. Update todo items as you complete them
4. Commit changes in logical, small chunks

### After Completing Feature
1. **MANDATORY**: Run full test suite and ensure all pass
2. **MANDATORY**: Update documentation (README, docstrings, comments)
3. **MANDATORY**: Update todo list with completion status
4. Consider performance implications and optimization opportunities

### Git Commit Standards
- Use descriptive commit messages following conventional commits
- Include test results and documentation updates in commit description
- Reference completed todo items in commit message
- Always include Claude co-authorship footer

## 📊 Monitoring and Performance

### Performance Requirements
- **API Response Time**: < 200ms for standard endpoints
- **WebSocket Latency**: < 100ms for real-time feedback
- **Audio Processing**: < 500ms per chunk analysis
- **Database Queries**: Optimize for < 50ms query time

### Monitoring Points
- Track API endpoint response times
- Monitor WebSocket connection stability
- Log audio processing pipeline performance
- Track Gemini AI response times and costs

## 🔧 Configuration Management

### Environment Variables
- All configuration via environment variables
- Separate configs for development, testing, production
- Never hardcode API keys or sensitive values
- Document all environment variables in README

### Service Configuration
- Modular service configuration
- Easy switching between development and production services
- Graceful degradation when services unavailable
- Health checks for all external dependencies

## 🎯 AURA-Specific Rules

### Audio Processing
- Support multiple audio formats (WAV, MP3, M4A, OGG)
- Validate file sizes and formats before processing
- Use appropriate sample rates (16kHz for voice analysis)
- Handle real-time audio streaming with proper buffering

### AI Integration
- Use appropriate Gemini models (Flash for speed, Pro for quality)
- Implement proper retry logic for AI service calls
- Cache responses when appropriate to reduce costs
- Provide fallback responses when AI services unavailable

### WebSocket Management
- Implement proper connection lifecycle management
- Handle reconnection scenarios gracefully
- Validate all incoming WebSocket messages
- Provide meaningful error messages for connection issues

### Session Management
- Proper session state management
- Clean up resources when sessions end
- Support concurrent sessions per user
- Track session analytics and performance metrics

---

**Remember**: Every completed development stage MUST include comprehensive testing and documentation updates. No exceptions!

This ensures AURA maintains high quality, reliability, and maintainability as it grows and evolves.