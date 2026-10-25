import os
import zipfile
import shutil

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
ZIP_FILENAME = 'Gulf_Taxis_Dispatch_Cloud_Complete.zip'
OUTPUT_ZIP_PATH = os.path.join(ROOT_DIR, ZIP_FILENAME)
PUBLIC_ZIP_PATH = os.path.join(ROOT_DIR, 'public', ZIP_FILENAME)

EXCLUDE_DIRS = {
    'node_modules',
    '.git',
    '.aistudio',
    '__pycache__',
    '.cache',
}

EXCLUDE_FILES = {
    ZIP_FILENAME,
    'create_package.py',
    '.DS_Store',
    'npm-debug.log',
}

def make_archive():
    print(f"Creating {OUTPUT_ZIP_PATH} from {ROOT_DIR}...")
    
    # Ensure public folder exists
    os.makedirs(os.path.join(ROOT_DIR, 'public'), exist_ok=True)
    
    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(OUTPUT_ZIP_PATH, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for root, dirs, files in os.walk(ROOT_DIR):
            # Modify dirs in-place to avoid descending into excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]

            for file in files:
                if file in EXCLUDE_FILES or file.endswith('.zip'):
                    continue
                
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, ROOT_DIR)
                
                # Prefix files inside a clean root folder inside ZIP
                arcname = os.path.join('Gulf_Taxis_Dispatch_Cloud_Complete', rel_path)
                
                file_size = os.path.getsize(full_path)
                total_uncompressed_bytes += file_size
                file_count += 1
                
                zipf.write(full_path, arcname)

    # Copy to public folder so Vite and Express can serve it directly
    shutil.copy2(OUTPUT_ZIP_PATH, PUBLIC_ZIP_PATH)

    zip_size = os.path.getsize(OUTPUT_ZIP_PATH)
    print(f"✅ Archive successfully generated!")
    print(f"📦 Files packaged: {file_count}")
    print(f"💾 Uncompressed size: {total_uncompressed_bytes / (1024*1024):.2f} MB")
    print(f"🗜️ Compressed ZIP size: {zip_size / (1024*1024):.2f} MB")
    print(f"📍 Location 1: {OUTPUT_ZIP_PATH}")
    print(f"📍 Location 2: {PUBLIC_ZIP_PATH}")

if __name__ == '__main__':
    make_archive()
