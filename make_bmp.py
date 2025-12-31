import struct

def create_bmp(width, height, filename):
    # BMP Header
    file_size = 54 + 3 * width * height
    header = b'BM' + struct.pack('<I', file_size) + b'\x00\x00\x00\x00' + b'\x36\x00\x00\x00'

    # DIB Header
    dib = struct.pack('<I', 40) + \
          struct.pack('<i', width) + \
          struct.pack('<i', height) + \
          b'\x01\x00' + b'\x18\x00' + b'\x00\x00\x00\x00' + \
          struct.pack('<I', 3 * width * height) + \
          b'\x13\x0B\x00\x00' + b'\x13\x0B\x00\x00' + \
          b'\x00\x00\x00\x00' + b'\x00\x00\x00\x00'

    # Pixel Data (Blue)
    pixels = b'\xFF\x00\x00' * (width * height)

    with open(filename, 'wb') as f:
        f.write(header + dib + pixels)

create_bmp(800, 600, 'verification/test_image.bmp')
