import json
import os
import zipfile
import shutil

ANIMATIONS_DIR = "/Users/maybachlarp/wryft/myapp/assets/lottie"
os.makedirs(ANIMATIONS_DIR, exist_ok=True)

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return [int(hex_color[i:i+2], 16) for i in (0, 2, 4)]

def create_ellipse_shape(name, size_x, size_y, pos_x, pos_y, stroke_color, stroke_width):
    r, g, b = hex_to_rgb(stroke_color)
    return [
        {
            "ty": "el",
            "nm": f"{name} ellipse",
            "p": {"a": 0, "k": [pos_x, pos_y]},
            "s": {"a": 0, "k": [size_x, size_y]}
        },
        {
            "ty": "st",
            "nm": f"{name} stroke",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "w": {"a": 0, "k": stroke_width},
            "lc": 1,
            "lj": 1
        }
    ]

def create_path_shape(name, vertices, tangents_in, tangents_out, closed, stroke_color, stroke_width):
    r, g, b = hex_to_rgb(stroke_color)
    return [
        {
            "ty": "sh",
            "nm": f"{name} path",
            "ks": {
                "a": 0,
                "k": {
                    "c": closed,
                    "v": vertices,
                    "i": tangents_in,
                    "o": tangents_out
                }
            }
        },
        {
            "ty": "st",
            "nm": f"{name} stroke",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "w": {"a": 0, "k": stroke_width},
            "lc": 1,
            "lj": 1
        }
    ]

def make_transform(position, anchor, scale_keyframes=None, rotation_keyframes=None, opacity_keyframes=None, position_keyframes=None):
    t = {
        "o": {"a": 0, "k": 100} if not opacity_keyframes else {"a": 1, "k": opacity_keyframes},
        "r": {"a": 0, "k": 0} if not rotation_keyframes else {"a": 1, "k": rotation_keyframes},
        "p": {"a": 0, "k": position} if not position_keyframes else {"a": 1, "k": position_keyframes},
        "a": {"a": 0, "k": anchor},
        "s": {"a": 0, "k": [100, 100]} if not scale_keyframes else {"a": 1, "k": scale_keyframes}
    }
    return t

def create_layer(index, name, shapes, transform, parent=None, op=90):
    layer = {
        "ddd": 0,
        "ind": index,
        "ty": 4,
        "nm": name,
        "ks": transform,
        "ao": 0,
        "shapes": shapes,
        "ip": 0,
        "op": op
    }
    if parent is not None:
        layer["parent"] = parent
    return layer

def create_rounded_rect_shape(name, size_x, size_y, pos_x, pos_y, corner_radius, stroke_color, stroke_width):
    r, g, b = hex_to_rgb(stroke_color)
    return [
        {
            "ty": "rc",
            "nm": f"{name} rect",
            "p": {"a": 0, "k": [pos_x, pos_y]},
            "s": {"a": 0, "k": [size_x, size_y]},
            "r": {"a": 0, "k": corner_radius}
        },
        {
            "ty": "st",
            "nm": f"{name} stroke",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "w": {"a": 0, "k": stroke_width},
            "lc": 1,
            "lj": 1
        }
    ]

def create_circle_shape(name, size_x, size_y, pos_x, pos_y, fill_color):
    r, g, b = hex_to_rgb(fill_color)
    return [
        {
            "ty": "el",
            "nm": f"{name} ellipse",
            "p": {"a": 0, "k": [pos_x, pos_y]},
            "s": {"a": 0, "k": [size_x, size_y]}
        },
        {
            "ty": "fl",
            "nm": f"{name} fill",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "r": 2
        }
    ]

def create_dotlottie(lottie_json, filename):
    # Create temp directory for dotLottie contents
    temp_dir = os.path.join(ANIMATIONS_DIR, "temp_" + filename.replace(".", "_"))
    os.makedirs(temp_dir, exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "animations"), exist_ok=True)
    
    # Write manifest.json
    manifest = {
        "version": 1,
        "revision": 1,
        "author": "",
        "generator": "LottieFiles MCP",
        "animations": [
            {
                "id": filename.replace(".lottie", ""),
                "themeColor": "#6C63FF",
                "loop": True,
                "speed": 1
            }
        ]
    }
    
    with open(os.path.join(temp_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f)
    
    # Ensure assets field exists (required by lottie-react-native types)
    if "assets" not in lottie_json:
        lottie_json["assets"] = []
    
    # Write animation JSON
    with open(os.path.join(temp_dir, "animations", f"{filename.replace('.lottie', '')}.json"), "w") as f:
        json.dump(lottie_json, f)
    
    # Create .lottie zip file
    output_path = os.path.join(ANIMATIONS_DIR, filename)
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, temp_dir)
                zf.write(file_path, arcname)
    
    # Also write raw .json file alongside the .lottie file
    json_out = os.path.join(ANIMATIONS_DIR, filename.replace('.lottie', '.json'))
    with open(json_out, 'w') as f:
        json.dump(lottie_json, f)
    
    # Clean up temp directory
    shutil.rmtree(temp_dir)
    
    return output_path


# ============= GLOBE ANIMATION =============
def create_globe():
    cx, cy = 100, 100
    total_frames = 72  # 2.4s at 30fps — seamless loop
    
    # Static scale — no entrance bounce
    static_scale = 100
    
    size_x = 140
    size_y = 140
    
    globe_shapes = create_ellipse_shape("Globe Circle", size_x, size_y, 0, 0, "#6C63FF", 4)
    
    lat_top_v = [[-60, -30], [0, -58], [60, -30]]
    lat_top_i = [[0, 0], [-25, 0], [0, 0]]
    lat_top_o = [[25, 0], [0, 0], [-25, 0]]
    lat_top_shapes = create_path_shape("Latitude Top", lat_top_v, lat_top_i, lat_top_o, False, "#6C63FF", 3)
    
    lat_bot_v = [[-60, 30], [0, 58], [60, 30]]
    lat_bot_i = [[0, 0], [-25, 0], [0, 0]]
    lat_bot_o = [[25, 0], [0, 0], [-25, 0]]
    lat_bot_shapes = create_path_shape("Latitude Bottom", lat_bot_v, lat_bot_i, lat_bot_o, False, "#6C63FF", 3)
    
    long_shapes = create_ellipse_shape("Longitude", 80, size_y, 0, 0, "#6C63FF", 3)
    
    # Opacity pulse from frame 0: 0.6 → 1 → 0.6
    half = total_frames // 2
    opacity_pulse = [
        {"t": 0, "s": [60]},
        {"t": half, "s": [100]},
        {"t": total_frames, "s": [60]}
    ]
    
    # Rotation: 0 → 360 over total_frames
    long_rotation = [
        {"t": 0, "s": [0]},
        {"t": total_frames, "s": [360]}
    ]
    
    layers = [
        create_layer(0, "Globe Circle", globe_shapes, make_transform([cx, cy], [0, 0]), op=total_frames),
        create_layer(1, "Latitude Top", lat_top_shapes, make_transform([cx, cy], [0, 0], opacity_keyframes=opacity_pulse), op=total_frames),
        create_layer(2, "Latitude Bottom", lat_bot_shapes, make_transform([cx, cy], [0, 0], opacity_keyframes=opacity_pulse), op=total_frames),
        create_layer(3, "Longitude", long_shapes, make_transform([cx, cy], [0, 0], rotation_keyframes=long_rotation), op=total_frames)
    ]
    
    lottie = {
        "v": "5.5.0",
        "fr": 30,
        "ip": 0,
        "op": total_frames,
        "w": 200,
        "h": 200,
        "nm": "Globe Animation",
        "layers": layers,
        "assets": []
    }
    
    path = create_dotlottie(lottie, "globe.lottie")
    print(f"Globe animation created: {path}")
    return path

# ============= LOCK ANIMATION =============
def create_lock():
    cx, cy = 100, 100
    
    # Scale entrance for body: 0 → 1.1 → 1 (380ms = ~11 frames at 30fps)
    body_scale_entrance = [
        {"t": 0, "s": [0, 0], "i": {"x": [0.5], "y": [1]}, "o": {"x": [0.5], "y": [0]}},
        {"t": 8, "s": [110, 110], "i": {"x": [0.5], "y": [1]}, "o": {"x": [0.5], "y": [0]}},
        {"t": 12, "s": [100, 100]}
    ]
    
    # Shackle Y position: starts at -30, comes to 0
    shackle_y = [
        {"t": 0, "s": [cx, cy - 60], "i": {"x": [0.5], "y": [1]}, "o": {"x": [0.5], "y": [0]}},
        {"t": 12, "s": [cx, cy - 30]}
    ]
    
    # Locking moment (frames 20-40):
    # Shackle snaps down +2px
    shackle_snap_y = [
        {"t": 20, "s": [cx, cy - 30]},
        {"t": 24, "s": [cx, cy - 28]},
        {"t": 28, "s": [cx, cy - 30]}
    ]
    
    # Body squish: scaleY 0.95 → 1
    body_squish = [
        {"t": 22, "s": [100, 100]},
        {"t": 24, "s": [100, 95]},
        {"t": 28, "s": [100, 100]}
    ]
    
    # Satisfaction shake: rotateZ ±2° × 2 cycles
    shake_rotation = [
        {"t": 28, "s": [0]},
        {"t": 30, "s": [2]},
        {"t": 32, "s": [-2]},
        {"t": 34, "s": [2]},
        {"t": 36, "s": [-2]},
        {"t": 38, "s": [0]}
    ]
    
    # Idle glow pulse on keyhole: opacity 0.5 → 1 → 0.5, 1.8s loop (54 frames at 30fps)
    keyhole_opacity = [
        {"t": 40, "s": [50]},
        {"t": 67, "s": [100]},
        {"t": 94, "s": [50]}
    ]
    
    # Total frames for locking sequence: ~40 frames
    # Idle loop continues from 40 to 94+ (54 frames loop)
    total_frames = 95
    
    # Shackle path: U-shape going up from left to right over the lock body
    # Body is at (cx, cy) with size ~70×50, so body top is at cy-25
    # Shackle goes from body left-top up and over to body right-top
    shackle_v = [[-28, -25], [-28, -48], [0, -58], [28, -48], [28, -25]]
    shackle_i = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]
    shackle_o = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]
    
    r, g, b = hex_to_rgb("#6C63FF")
    
    # Shackle shapes
    shackle_shapes = create_path_shape("Shackle", shackle_v, shackle_i, shackle_o, False, "#6C63FF", 5)
    
    # Lock body shapes (rounded rectangle)
    body_shapes = create_rounded_rect_shape("Lock Body", 70, 50, 0, 0, 8, "#6C63FF", 4)
    
    # Keyhole (small filled circle)
    keyhole_shapes = create_circle_shape("Keyhole", 12, 16, 0, 2, "#6C63FF")
    
    # Combine shackle Y movement: entrance + snap
    # Use combined keyframes
    shackle_full_y = shackle_y + [{"t": s["t"], "s": s["s"]} for s in shackle_snap_y[1:]]
    
    # Create layers
    layers = [
        create_layer(0, "Shackle", shackle_shapes, make_transform(
            [cx, cy - 30], [0, 0], 
            scale_keyframes=body_scale_entrance,
            position_keyframes=shackle_full_y
        )),
        create_layer(1, "Lock Body", body_shapes, make_transform(
            [cx, cy + 10], [0, 0], 
            scale_keyframes=body_scale_entrance + body_squish,
            rotation_keyframes=shake_rotation
        )),
        create_layer(2, "Keyhole", keyhole_shapes, make_transform(
            [cx, cy + 10], [0, 0],
            scale_keyframes=body_scale_entrance,
            opacity_keyframes=keyhole_opacity
        ))
    ]
    
    lottie = {
        "v": "5.5.0",
        "fr": 30,
        "ip": 0,
        "op": total_frames,
        "w": 200,
        "h": 200,
        "nm": "Lock Animation",
        "layers": layers,
        "markers": [
            {"cm": "entrance", "tm": 0},
            {"cm": "locking", "tm": 20},
            {"cm": "idle", "tm": 40}
        ]
    }
    
    path = create_dotlottie(lottie, "lock.lottie")
    print(f"Lock animation created: {path}")
    return path

# ============= PAPER PLANE ANIMATION =============
def create_paperplane():
    cx, cy = 100, 100
    
    # Paper plane body (triangle pointing right)
    # Points: tip=(40,0), top-rear=(-20,-18), bottom-rear=(-20,18)
    body_v = [[40, 0], [-20, -18], [-20, 18]]
    body_i = [[0, 0], [0, 0], [0, 0]]
    body_o = [[0, 0], [0, 0], [20, 0]]
    
    # Tail fold (small triangle underneath at the rear)
    # Points: bottom-rear area
    tail_v = [[-15, 15], [-25, 25], [-10, 22]]
    tail_i = [[0, 0], [0, 0], [0, 0]]
    tail_o = [[0, 0], [0, 0], [0, 0]]
    
    r, g, b = hex_to_rgb("#6C63FF")
    
    # Body shapes (filled)
    body_shapes = [
        {
            "ty": "sh",
            "nm": "Paper Plane Body",
            "ks": {
                "a": 0,
                "k": {
                    "c": True,
                    "v": body_v,
                    "i": body_i,
                    "o": body_o
                }
            }
        },
        {
            "ty": "fl",
            "nm": "Body fill",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "r": 2
        }
    ]
    
    # Tail shapes (filled)
    tail_shapes = [
        {
            "ty": "sh",
            "nm": "Paper Plane Tail",
            "ks": {
                "a": 0,
                "k": {
                    "c": True,
                    "v": tail_v,
                    "i": tail_i,
                    "o": tail_o
                }
            }
        },
        {
            "ty": "fl",
            "nm": "Tail fill",
            "c": {"a": 0, "k": [r/255, g/255, b/255, 1]},
            "o": {"a": 0, "k": 100},
            "r": 2
        }
    ]
    
    # Entrance fly-in: position moves from (-60, +40) to (0, 0) with arc
    # Use position keyframes for smooth arc motion
    fly_position = [
        {"t": 0, "s": [cx - 60, cy + 40], "i": {"x": [0.68], "y": [0.68]}, "o": {"x": [0], "y": [0]}},
        {"t": 14, "s": [cx, cy]}
    ]
    
    # Scale entrance: 1.08 → 1 (bounce settle after arrival at frame 14)
    scale_settle = [
        {"t": 0, "s": [0, 0], "i": {"x": [0.5], "y": [1]}, "o": {"x": [0.5], "y": [0]}},
        {"t": 14, "s": [108, 108], "i": {"x": [0.5], "y": [1]}, "o": {"x": [0.5], "y": [0]}},
        {"t": 20, "s": [100, 100]}
    ]
    
    # Idle bob: Y ±5px over 60 frames (2s at 30fps)
    idle_bob = [
        {"t": 20, "s": [cx, cy]},
        {"t": 35, "s": [cx, cy - 5]},
        {"t": 50, "s": [cx, cy + 5]},
        {"t": 80, "s": [cx, cy]}
    ]
    
    # Idle tilt: rotateZ ±3°, offset by ~15 frames from bob
    idle_tilt = [
        {"t": 20, "s": [0]},
        {"t": 38, "s": [3]},
        {"t": 56, "s": [-3]},
        {"t": 80, "s": [0]}
    ]
    
    # Place both body and tail in same pre-comp group
    # Actually, separate layers so they share transform
    layers = [
        create_layer(0, "Paper Plane Body", body_shapes, make_transform(
            [cx, cy], [0, 0],
            scale_keyframes=scale_settle,
            position_keyframes=idle_bob
        )),
        create_layer(1, "Paper Plane Tail", tail_shapes, make_transform(
            [cx, cy], [0, 0],
            scale_keyframes=scale_settle,
            position_keyframes=idle_bob
        ))
    ]
    
    # Add rotation to both layers via parent
    # Actually, let's just add rotation to the layers individually
    layers[0]["ks"]["r"] = {"a": 1, "k": idle_tilt}
    layers[1]["ks"]["r"] = {"a": 1, "k": idle_tilt}
    
    lottie = {
        "v": "5.5.0",
        "fr": 30,
        "ip": 0,
        "op": 81,
        "w": 200,
        "h": 200,
        "nm": "Paper Plane Animation",
        "layers": layers,
        "markers": [
            {"cm": "entrance", "tm": 0},
            {"cm": "idle", "tm": 20}
        ]
    }
    
    path = create_dotlottie(lottie, "paperplane.lottie")
    print(f"Paper Plane animation created: {path}")
    return path

if __name__ == "__main__":
    create_globe()
    create_lock()
    create_paperplane()
