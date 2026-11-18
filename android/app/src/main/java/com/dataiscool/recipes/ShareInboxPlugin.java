package com.dataiscool.recipes;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Receives links, text and images shared to the app from other apps (Chrome, Instagram, gallery…)
 * and reads text from images on the phone with ML Kit (no internet needed).
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {
    private static final List<JSObject> pending = new ArrayList<>();
    private static ShareInboxPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void handleIntent(Context ctx, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null || (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action))) return;

        JSArray texts = new JSArray();
        JSArray images = new JSArray();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text != null && !text.trim().isEmpty()) {
            texts.put(subject != null && !text.contains(subject) ? subject + "\n" + text : text);
        }
        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) {
                String p = copyToCache(ctx, uri);
                if (p != null) images.put(p);
            }
        } else {
            ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (uris != null) {
                for (Uri u : uris) {
                    String p = copyToCache(ctx, u);
                    if (p != null) images.put(p);
                }
            }
        }
        intent.setAction("com.dataiscool.recipes.HANDLED"); // don't import the same share twice
        if (texts.length() == 0 && images.length() == 0) return;

        JSObject item = new JSObject();
        item.put("texts", texts);
        item.put("images", images);
        item.put("at", System.currentTimeMillis());
        synchronized (pending) {
            pending.add(item);
        }
        if (instance != null) instance.notifyListeners("shared", new JSObject());
    }

    private static String copyToCache(Context ctx, Uri uri) {
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            File dir = new File(ctx.getCacheDir(), "shared");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "img_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1e6) + ".jpg");
            try (OutputStream out = new FileOutputStream(f)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return f.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }

    /** Returns and clears everything shared since the last call. */
    @PluginMethod
    public void getPending(PluginCall call) {
        JSArray arr = new JSArray();
        synchronized (pending) {
            for (JSObject o : pending) arr.put(o);
            pending.clear();
        }
        JSObject r = new JSObject();
        r.put("items", arr);
        call.resolve(r);
    }

    /** Reads text from a base64 image (JPEG/PNG). Returns lines grouped in blocks. */
    @PluginMethod
    public void recognize(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("data required");
            return;
        }
        try {
            int comma = data.indexOf(',');
            byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) {
                call.reject("Could not read that image");
                return;
            }
            InputImage image = InputImage.fromBitmap(bmp, 0);
            TextRecognizer rec = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            rec.process(image)
                .addOnSuccessListener(result -> {
                    StringBuilder sb = new StringBuilder();
                    for (Text.TextBlock b : result.getTextBlocks()) {
                        for (Text.Line l : b.getLines()) sb.append(l.getText()).append('\n');
                        sb.append('\n');
                    }
                    JSObject r = new JSObject();
                    r.put("text", sb.toString());
                    call.resolve(r);
                    rec.close();
                })
                .addOnFailureListener(e -> {
                    call.reject(e.getMessage() == null ? "Text recognition failed" : e.getMessage());
                    rec.close();
                });
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Text recognition failed" : e.getMessage());
        }
    }
}
