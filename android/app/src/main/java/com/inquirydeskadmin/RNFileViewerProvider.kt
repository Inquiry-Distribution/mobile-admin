package com.inquirydeskadmin

import androidx.core.content.FileProvider

// Empty subclass required so Android allows two FileProvider entries
// with different authorities in the same app.
// Used by react-native-file-viewer (authority: applicationId.provider).
class RNFileViewerProvider : FileProvider()
