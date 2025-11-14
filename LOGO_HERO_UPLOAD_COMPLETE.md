# Logo & Hero Image Upload Implementation - Complete

## Overview
Successfully implemented full file upload functionality for department logos and hero images using Appwrite Storage.

## ✅ What Was Implemented

### 1. Upload Actions (Server-Side)
**File**: `apps/admin/src/lib/actions/departments.ts`

Added two new server actions:
- `uploadDepartmentLogo(formData)` - Uploads to "units" bucket
- `uploadDepartmentHero(formData)` - Uploads to "content" bucket

Both functions:
- Accept FormData with file
- Upload to Appwrite Storage
- Return file ID and public URL
- Follow the same pattern as `uploadProductImage`

### 2. Logo Upload Component (Redesigned)
**File**: `apps/admin/src/components/units/logo-upload-preview.tsx`

**Features**:
- ✅ **File Upload**: Click to select files from computer
- ✅ **Drag & Drop Ready**: Infrastructure in place
- ✅ **Loading States**: Shows spinner during upload
- ✅ **Live Preview**: Image displays immediately after upload
- ✅ **Alternative URL Input**: Can still paste URLs if needed
- ✅ **Change/Remove**: Easy buttons to change or clear logo
- ✅ **Fallback Display**: Shows department initials when no logo
- ✅ **Recommended Size**: "256x256px, square format" guidance

**Storage**: Uses Appwrite "units" bucket

### 3. Hero Image Upload Component (NEW)
**File**: `apps/admin/src/components/units/hero-upload-preview.tsx`

**Features**:
- ✅ **File Upload**: Upload custom hero backgrounds
- ✅ **Default Fallback**: Uses your default hero_bg image
- ✅ **Live Preview**: Shows 16:5 aspect ratio preview
- ✅ **Loading States**: Upload progress indicator
- ✅ **Default Indicator**: Badge shows "Default Background" when using fallback
- ✅ **Reset to Default**: Clear custom hero to use default
- ✅ **Alternative URL Input**: Can paste URLs if needed
- ✅ **Recommended Size**: "1920x600px, landscape format" guidance

**Storage**: Uses Appwrite "content" bucket
**Default**: `https://appwrite.biso.no/v1/storage/buckets/content/files/hero_bg/view?project=biso`

### 4. Department Schema Updated
**File**: `apps/admin/src/app/(admin)/admin/units/shared/department-editor.tsx`

- ✅ Added `hero` field to schema (URL, optional)
- ✅ Included hero in form defaults
- ✅ Saves hero URL on create/update
- ✅ Hero upload component integrated into editor layout

### 5. Web App Hero Display
**File**: `apps/web/src/app/(public)/units/[id]/components/department-hero.tsx`

- ✅ Uses custom hero image from department if available
- ✅ Falls back to default hero_bg if no custom hero
- ✅ Maintains all existing gradient overlays and styling

## 📦 Storage Buckets Used

### Units Bucket
- **ID**: `units`
- **Purpose**: Department logo images
- **Recommended Size**: 256x256px (square)
- **Format**: Any image format (PNG, JPG, WebP)

### Content Bucket
- **ID**: `content`
- **Purpose**: Hero background images
- **Recommended Size**: 1920x600px (landscape)
- **Format**: Any image format (JPG recommended for file size)

## 🎨 User Experience

### For Department Managers:
1. **Upload Logo**:
   - Click "Upload File" button
   - Select image from computer
   - See instant preview
   - Logo automatically saved with department

2. **Upload Hero Background**:
   - See default hero background initially
   - Click "Upload Custom Hero"
   - Select wide landscape image
   - Preview updates immediately
   - Can reset to default anytime

3. **Alternative URL Method**:
   - Click "Or use URL" for both logo and hero
   - Paste image URL from external source
   - Useful for CDN-hosted images

## 📐 Image Recommendations

### Logo (Square Format)
- **Dimensions**: 256x256px
- **Aspect Ratio**: 1:1
- **Format**: PNG (for transparency) or JPG
- **File Size**: < 500KB recommended
- **Usage**: Department cards, headers, badges

### Hero Background (Landscape Format)
- **Dimensions**: 1920x600px
- **Aspect Ratio**: 16:5
- **Format**: JPG (for smaller file size) or PNG
- **File Size**: < 2MB recommended
- **Usage**: Department detail page hero section

## 🔧 Technical Details

### Upload Flow
1. User selects file in component
2. File added to FormData
3. Server action called (`uploadDepartmentLogo` or `uploadDepartmentHero`)
4. File uploaded to Appwrite Storage
5. Public URL generated and returned
6. URL saved to department record
7. Form reflects new URL
8. Preview updates instantly

### Error Handling
- File validation on client side
- Server-side error catching
- Toast notifications for success/failure
- Loading states prevent duplicate uploads
- Input cleared after upload

### Integration Points
- ✅ Admin editor form (create & update)
- ✅ Web app department hero display
- ✅ Department cards (logo already working)
- ✅ Both URL and file upload methods supported

## 🚀 What's Working Now

1. **Logo Upload**: ✅ Fully functional
   - File upload to "units" bucket
   - Live preview
   - Change/remove options
   - URL alternative

2. **Hero Upload**: ✅ Fully functional
   - File upload to "content" bucket
   - Live preview (16:5 aspect ratio)
   - Default fallback
   - Reset to default
   - URL alternative

3. **Web Display**: ✅ Fully functional
   - Custom hero displays on department page
   - Falls back to default hero_bg
   - All styling preserved

## 📝 Files Modified/Created

### Modified:
- `apps/admin/src/lib/actions/departments.ts` (+46 lines)
- `apps/admin/src/app/(admin)/admin/units/shared/department-editor.tsx` (schema + hero section)
- `apps/web/src/app/(public)/units/[id]/components/department-hero.tsx` (hero display logic)

### Created:
- `apps/admin/src/components/units/logo-upload-preview.tsx` (redesigned)
- `apps/admin/src/components/units/hero-upload-preview.tsx` (new)

## 🎯 Manager Benefits

1. **No Technical Knowledge Required**: Just click and upload
2. **Instant Feedback**: See preview immediately
3. **Flexible Options**: Upload file OR paste URL
4. **Safe Defaults**: Default hero always available
5. **Easy Changes**: Change or remove anytime
6. **Visual Guidance**: Recommended sizes clearly displayed
7. **Premium Experience**: Loading states, smooth animations, glassmorphism

## ✅ Testing Checklist

- [x] Logo file upload works
- [x] Hero file upload works
- [x] Default hero displays when no custom hero
- [x] Custom hero displays on web app
- [x] Loading states show during upload
- [x] Error handling works
- [x] URL input alternative works
- [x] Reset to default works for hero
- [x] Preview updates immediately
- [x] Saved correctly in database
- [x] No linting errors

## 🎉 Status
**COMPLETE** - Department managers can now upload logos and custom hero backgrounds with ease!

