#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

static void emit(NSDictionary *value) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    puts([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
}
static void fail(NSString *message) { emit(@{@"error":message}); exit(0); }
int main(int argc, const char *argv[]) { @autoreleasepool {
    NSString *action = argc > 1 ? @(argv[1]) : @"permissions";
    NSDictionary *args = argc > 2 ? [NSJSONSerialization JSONObjectWithData:[@(argv[2]) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : @{};
    BOOL accessible = AXIsProcessTrusted(), screen = CGPreflightScreenCaptureAccess();
    if ([action isEqual:@"permissions"]) { emit(@{@"accessibility":@(accessible), @"screenRecording":@(screen)}); return 0; }
    if ([action isEqual:@"request-permissions"]) {
        AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)@{(__bridge NSString *)kAXTrustedCheckOptionPrompt:@YES});
        CGRequestScreenCaptureAccess(); emit(@{@"requested":@YES}); return 0;
    }
    NSString *target = args[@"_targetApp"];
    pid_t targetPid = 0;
    if (target) {
        NSRunningApplication *app = [NSRunningApplication runningApplicationsWithBundleIdentifier:target].firstObject;
        if (!app) fail(@"A aplicação indicada não está aberta.");
        targetPid = app.processIdentifier;
        [app activateWithOptions:0];
        [NSThread sleepForTimeInterval:0.25];
        if (![NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier isEqual:target]) fail(@"Não foi possível focar a aplicação.");
    }
    if ([action isEqual:@"computer_screenshot"]) {
        if (!screen) fail(@"Autoriza Gravação do ecrã para AXIONControl nas Definições do macOS.");
        if (@available(macOS 14.0, *)) {
            NSString *application = NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier ?: @"";
            [SCShareableContent getShareableContentExcludingDesktopWindows:NO onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content, NSError *error) {
                if (error) fail(@"Não foi possível consultar os ecrãs autorizados.");
                SCDisplay *display = nil;
                for (SCDisplay *candidate in content.displays) if (candidate.displayID == CGMainDisplayID()) display = candidate;
                if (!display) fail(@"Ecrã principal indisponível.");
                CGRect bounds = CGDisplayBounds(display.displayID);
                SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingWindows:@[]];
                SCStreamConfiguration *config = [SCStreamConfiguration new];
                config.width = MIN(display.width, 1600); config.height = config.width * bounds.size.height / bounds.size.width; config.showsCursor = NO;
                [SCScreenshotManager captureImageWithFilter:filter configuration:config completionHandler:^(CGImageRef image, NSError *captureError) {
                    if (captureError || !image) fail(@"Não foi possível capturar o ecrã.");
                    NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:image];
                    NSData *data = [bitmap representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor:@0.75}];
                    if (!data) fail(@"Não foi possível codificar a imagem.");
                    emit(@{@"image":[@"data:image/jpeg;base64," stringByAppendingString:[data base64EncodedStringWithOptions:0]], @"application":application, @"width":@(bounds.size.width), @"height":@(bounds.size.height), @"imageWidth":@(CGImageGetWidth(image)), @"imageHeight":@(CGImageGetHeight(image)), @"coordinateSpace":@"Coordenadas em pontos: x = pixelX * width / imageWidth; y = pixelY * height / imageHeight."}); exit(0);
                }];
            }];
            dispatch_main();
        } else fail(@"O controlo visual requer macOS 14 ou superior.");
    }
    if (!accessible) fail(@"Autoriza Acessibilidade para AXIONControl nas Definições do macOS.");
    if ([@[@"computer_type", @"computer_key"] containsObject:action] && [@[@"com.apple.Terminal", @"com.googlecode.iterm2", @"dev.warp.Warp-Stable"] containsObject:NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier ?: @""]) fail(@"Execução de comandos de terminal não está disponível neste modo.");
    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if ([action isEqual:@"computer_click"]) {
        if (![args[@"x"] isKindOfClass:NSNumber.class] || ![args[@"y"] isKindOfClass:NSNumber.class]) fail(@"Coordenadas inválidas.");
        CGPoint point = CGPointMake([args[@"x"] doubleValue], [args[@"y"] doubleValue]);
        if (!isfinite(point.x) || !isfinite(point.y) || !CGRectContainsPoint(CGDisplayBounds(CGMainDisplayID()), point)) fail(@"Coordenadas inválidas.");
        BOOL right = [args[@"button"] isEqual:@"right"];
        CGEventRef down = CGEventCreateMouseEvent(source, right ? kCGEventRightMouseDown : kCGEventLeftMouseDown, point, right ? kCGMouseButtonRight : kCGMouseButtonLeft);
        CGEventRef up = CGEventCreateMouseEvent(source, right ? kCGEventRightMouseUp : kCGEventLeftMouseUp, point, right ? kCGMouseButtonRight : kCGMouseButtonLeft);
        CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up); CFRelease(down); CFRelease(up);
    } else if ([action isEqual:@"computer_type"]) {
        NSString *text = args[@"text"];
        if (![text isKindOfClass:NSString.class] || text.length > 4000) fail(@"Texto inválido ou demasiado longo.");
        [text enumerateSubstringsInRange:NSMakeRange(0, text.length) options:NSStringEnumerationByComposedCharacterSequences usingBlock:^(NSString *chunk, NSRange range, NSRange enclosingRange, BOOL *stop) {
            UniChar chars[chunk.length]; [chunk getCharacters:chars range:NSMakeRange(0, chunk.length)];
            CGEventRef down = CGEventCreateKeyboardEvent(source, 0, true), up = CGEventCreateKeyboardEvent(source, 0, false);
            CGEventKeyboardSetUnicodeString(down, chunk.length, chars); CGEventKeyboardSetUnicodeString(up, chunk.length, chars);
            CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up); CFRelease(down); CFRelease(up);
        }];
    } else if ([action isEqual:@"computer_key"]) {
        NSDictionary *keys = @{@"enter":@36,@"tab":@48,@"escape":@53,@"space":@49,@"backspace":@51,@"left":@123,@"right":@124,@"down":@125,@"up":@126,@"a":@0,@"c":@8,@"v":@9,@"l":@37,@"w":@13,@"t":@17,@"f":@3};
        NSNumber *key = keys[args[@"key"] ?: @""]; if (!key) fail(@"Tecla não suportada.");
        NSDictionary *flags = @{@"command":@(kCGEventFlagMaskCommand),@"shift":@(kCGEventFlagMaskShift),@"option":@(kCGEventFlagMaskAlternate),@"control":@(kCGEventFlagMaskControl)};
        for (int down = 1; down >= 0; down--) { CGEventRef event = CGEventCreateKeyboardEvent(source, key.unsignedShortValue, down); CGEventSetFlags(event, [flags[args[@"modifier"] ?: @""] unsignedLongLongValue]); CGEventPost(kCGHIDEventTap, event); CFRelease(event); }
    } else if ([action isEqual:@"computer_close_window"] || [action isEqual:@"computer_quit_application"]) {
        CGKeyCode key = [action isEqual:@"computer_close_window"] ? 13 : 12;
        for (int down = 1; down >= 0; down--) {
            CGEventRef event = CGEventCreateKeyboardEvent(source, key, down);
            CGEventSetFlags(event, kCGEventFlagMaskCommand);
            if (targetPid) CGEventPostToPid(targetPid, event); else CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }
        [NSThread sleepForTimeInterval:0.25];
    } else if ([action isEqual:@"computer_scroll"]) {
        int dy = MAX(-1000, MIN(1000, [args[@"deltaY"] intValue])), dx = MAX(-1000, MIN(1000, [args[@"deltaX"] intValue]));
        CGEventRef event = CGEventCreateScrollWheelEvent(source, kCGScrollEventUnitPixel, 2, dy, dx); CGEventPost(kCGHIDEventTap, event); CFRelease(event);
    } else fail(@"Operação não suportada.");
    CFRelease(source); emit(@{@"executed":@YES}); return 0;
} }
