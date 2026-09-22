import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell } from "../ui/shell.js";

const backLink = `<a class="back-link" href="/help-center">&larr; Back to Help Center</a>`;

const layout = (content, pathname) => renderShell({ content, currentPath: pathname });

const mount = (root, pathname, content) => {
  root.innerHTML = layout(content, pathname);
  bindShell(root);
};

// ---------------------------------------------------------------------------
// Generic static help article renderer (used for every /help/* sub-page)
// ---------------------------------------------------------------------------
const helpArticle = ({ path, title, description, heading, bodyHtml }) => ({
  path,
  async render(root, ctx) {
    setPageMetadata({ title: `${title} | MetsXMFanZone`, description, path: ctx?.pathname || path });
    const content = `
      <section class="content-width article">
        ${backLink}
        <div class="card-panel" style="max-width:850px">
          <h1>${escapeHtml(heading)}</h1>
          <div class="article-body">${bodyHtml}</div>
        </div>
      </section>`;
    mount(root, path, content);
  },
});

const helpArticles = [
  {
    path: "/help/create-account",
    title: "How to Create an Account",
    description: "Step-by-step guide on creating your MetsXMFanZone account to access exclusive Mets content and live streams.",
    heading: "How to Create an Account",
    bodyHtml: `
      <h2>Getting Started</h2>
      <p>Creating your MetsXMFanZone account is quick and easy. Follow these steps:</p>
      <h3>Step 1: Navigate to Sign Up</h3>
      <p>Click the "Sign Up" button in the top right corner of the website or navigate directly to the authentication page.</p>
      <h3>Step 2: Enter Your Information</h3>
      <ul><li>Provide your name and email address</li><li>Create a secure password</li><li>Add your phone number and notification preference</li></ul>
      <h3>Step 3: Select Your Plan</h3>
      <p>After creating your account, you'll be prompted to choose a subscription plan:</p>
      <ul>
        <li><strong>Free Plan:</strong> Access to basic content and community features</li>
        <li><strong>Weekly Plan ($3.99/week):</strong> Full access with weekly PayPal billing</li>
        <li><strong>Monthly Plan ($9.99/month):</strong> Live streams, replays, and premium content</li>
        <li><strong>Yearly Plan ($129.99/year):</strong> Full access with yearly PayPal billing</li>
      </ul>
      <h3>Step 4: Complete Payment (for paid plans)</h3>
      <p>Complete the checkout process through PayPal to activate your subscription.</p>
      <h3>Step 5: Start Enjoying Content</h3>
      <p>Once your account is set up, you can immediately start accessing content based on your plan tier.</p>
      <h2>Troubleshooting</h2>
      <p>If you encounter any issues during account creation, please visit our <a href="/contact">Contact</a> page for assistance.</p>`,
  },
  {
    path: "/help/navigate-platform",
    title: "Navigating the Platform",
    description: "Learn how to navigate MetsXMFanZone and discover all features including live streams, community, blog, and more.",
    heading: "Navigating the Platform",
    bodyHtml: `
      <h2>Main Navigation Menu</h2>
      <p>Access key sections from the navigation bar at the top of every page:</p>
      <h3>Home</h3><p>Your starting point featuring latest updates, stories, news tracker, and upcoming streams.</p>
      <h3>Live</h3><p>Watch live streams of Mets games, analysis, and special events. Available for Premium and Annual plan members.</p>
      <h3>Spring Training</h3><p>Access exclusive spring training content, game previews, and matchup information.</p>
      <h3>Community</h3><p>Connect with fellow Mets fans, share posts, view business advertisements, and participate in discussions.</p>
      <h3>Blog</h3><p>Read the latest articles, analysis, and news about the New York Mets.</p>
      <h3>Gallery</h3><p>Browse photos and video highlights from games and events.</p>
      <h3>Podcast</h3><p>Listen to podcast episodes and catch live podcast shows.</p>
      <h2>Mobile Features</h2>
      <ul>
        <li><strong>Pull to Refresh:</strong> Drag down on any page to refresh content</li>
        <li><strong>Hamburger Menu:</strong> Tap the menu icon to access all navigation links</li>
        <li><strong>App Install:</strong> Add MetsXMFanZone to your home screen for a native app experience</li>
      </ul>
      <h2>Dashboard</h2>
      <p>Access your personal dashboard to manage your profile, subscription, and preferences.</p>`,
  },
  {
    path: "/help/watch-streams",
    title: "Watching Live Streams",
    description: "Guide to watching live Mets game streams on MetsXMFanZone including device requirements and streaming tips.",
    heading: "Watching Live Streams",
    bodyHtml: `
      <h2>Requirements</h2>
      <p>To watch live streams on MetsXMFanZone:</p>
      <ul>
        <li>Active Premium ($9.99/month) or Annual ($129.99/year) subscription</li>
        <li>Stable internet connection (minimum 5 Mbps recommended)</li>
        <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
      </ul>
      <h2>How to Watch</h2>
      <h3>Step 1: Navigate to Live Page</h3>
      <p>Click "Live" in the main navigation menu to access the live streaming section.</p>
      <h3>Step 2: Select a Stream</h3>
      <p>Browse available live streams and click on the stream you want to watch.</p>
      <h3>Step 3: Enjoy the Stream</h3>
      <p>The video player will load automatically. Use the controls to adjust volume, quality, and fullscreen mode.</p>
      <h2>Device Restrictions</h2>
      <p><strong>Important:</strong> Users who access live streams from more than 2 devices or accounts will face automatic penalties including account restriction, plan downgrade, or account deactivation without warning.</p>
      <h2>Supported Devices</h2>
      <ul><li>Desktop computers (Windows, Mac, Linux)</li><li>Tablets (iPad, Android tablets)</li><li>Mobile phones (iPhone, Android)</li><li>Smart TVs with web browsers</li></ul>
      <h2>Troubleshooting</h2>
      <p>If you experience issues with streaming, see our <a href="/help/playback-issues">Troubleshooting Playback Issues</a> guide.</p>`,
  },
  {
    path: "/help/community-guidelines",
    title: "Community Guidelines",
    description: "MetsXMFanZone community guidelines and rules for respectful fan engagement and content sharing.",
    heading: "Community Guidelines",
    bodyHtml: `
      <h2>Our Community Values</h2>
      <p>MetsXMFanZone is a community for passionate Mets fans to connect, share, and celebrate our team. We expect all members to follow these guidelines.</p>
      <h2>Be Respectful</h2>
      <ul>
        <li>Treat all community members with respect and kindness</li>
        <li>No personal attacks, harassment, or bullying</li>
        <li>Respect different opinions and perspectives</li>
        <li>Keep discussions civil, even during heated debates</li>
      </ul>
      <h2>Prohibited Content</h2>
      <ul>
        <li>Hate speech, discrimination, or offensive language</li>
        <li>Spam, advertising, or promotional content without permission</li>
        <li>Copyrighted material without proper authorization</li>
        <li>Misinformation or false news</li>
        <li>NSFW content or inappropriate material</li>
      </ul>
      <h2>Posting Guidelines</h2>
      <ul>
        <li>Stay on topic and relevant to the Mets and baseball</li>
        <li>Use clear, descriptive titles for your posts</li>
        <li>Credit sources when sharing news or content</li>
        <li>Avoid excessive posting or duplicate content</li>
      </ul>
      <h2>Reporting Violations</h2>
      <p>If you see content that violates these guidelines, please report it immediately. See our <a href="/help/report-content">Reporting Inappropriate Content</a> guide.</p>
      <h2>Consequences</h2>
      <p>Violations of these guidelines may result in:</p>
      <ol><li>Warning from moderators</li><li>Temporary suspension of posting privileges</li><li>Permanent account ban for serious or repeated violations</li></ol>
      <h2>Questions</h2>
      <p>If you have questions about these guidelines, please <a href="/contact">contact us</a>.</p>`,
  },
  {
    path: "/help/video-quality",
    title: "Video Quality Settings",
    description: "Learn how to adjust video quality settings for optimal streaming on MetsXMFanZone based on your internet speed.",
    heading: "Video Quality Settings",
    bodyHtml: `
      <h2>Available Quality Options</h2>
      <p>MetsXMFanZone streams are available in multiple quality settings:</p>
      <h3>Auto (Recommended)</h3>
      <p>Automatically adjusts quality based on your internet connection speed for optimal viewing without buffering.</p>
      <h3>1080p (Full HD)</h3>
      <ul><li>Best quality available</li><li>Requires minimum 8 Mbps connection</li><li>Recommended for high-speed broadband</li></ul>
      <h3>720p (HD)</h3>
      <ul><li>Good quality with lower bandwidth</li><li>Requires minimum 5 Mbps connection</li><li>Recommended for standard broadband</li></ul>
      <h3>480p (SD)</h3>
      <ul><li>Standard definition quality</li><li>Requires minimum 2.5 Mbps connection</li><li>Recommended for slower connections or mobile data</li></ul>
      <h2>How to Change Quality</h2>
      <ol><li>Click on the video player while watching a stream</li><li>Look for the settings/gear icon in the player controls</li><li>Click on "Quality" option</li><li>Select your preferred quality level</li></ol>
      <h2>Recommended Settings</h2>
      <table><thead><tr><th>Connection Type</th><th>Recommended Quality</th></tr></thead>
      <tbody>
        <tr><td>Fiber/High-speed Broadband</td><td>Auto or 1080p</td></tr>
        <tr><td>Standard Broadband</td><td>720p</td></tr>
        <tr><td>Mobile Data/Slower Connections</td><td>480p</td></tr>
      </tbody></table>
      <h2>Troubleshooting Buffering</h2>
      <p>If you experience buffering issues, try lowering the quality setting or see our <a href="/help/playback-issues">Troubleshooting Playback Issues</a> guide.</p>`,
  },
  {
    path: "/help/premium-content",
    title: "Accessing Premium Content",
    description: "Learn what's included in premium plans and how to access exclusive MetsXMFanZone content.",
    heading: "Accessing Premium Content",
    bodyHtml: `
      <h2>What's Included in Premium</h2>
      <p>Premium and Annual plan members get access to exclusive content:</p>
      <h3>Live Streams</h3>
      <ul><li>Watch all Mets games live</li><li>Pre-game and post-game analysis</li><li>Special live events and Q&A sessions</li><li>Live podcast shows</li></ul>
      <h3>Spring Training Content</h3>
      <ul><li>Exclusive spring training game coverage</li><li>Behind-the-scenes content</li><li>Player interviews and insights</li></ul>
      <h3>Premium Features</h3>
      <ul><li>HD/Full HD streaming quality</li><li>Access to stream archives and replays</li><li>Ad-free experience</li><li>Priority customer support</li></ul>
      <h2>How to Upgrade</h2>
      <p>If you're on the Free plan and want to access premium content:</p>
      <ol><li>Navigate to the <a href="/pricing">Pricing</a> page</li><li>Select either Premium ($9.99/month) or Annual ($129.99/year)</li><li>Complete the checkout process</li><li>Start enjoying premium content immediately</li></ol>
      <h2>Free vs Premium</h2>
      <table><thead><tr><th>Feature</th><th>Free</th><th>Premium/Annual</th></tr></thead>
      <tbody>
        <tr><td>Blog Articles</td><td>✓</td><td>✓</td></tr>
        <tr><td>Community Access</td><td>✓</td><td>✓</td></tr>
        <tr><td>Gallery</td><td>✓</td><td>✓</td></tr>
        <tr><td>Live Streams</td><td>✗</td><td>✓</td></tr>
        <tr><td>Spring Training</td><td>✗</td><td>✓</td></tr>
        <tr><td>HD Quality</td><td>✗</td><td>✓</td></tr>
      </tbody></table>
      <h2>Questions</h2>
      <p>For more details about subscription plans, visit our <a href="/help/subscription-plans">Subscription Plans Explained</a> guide.</p>`,
  },
  {
    path: "/help/offline-viewing",
    title: "Download and Offline Viewing",
    description: "Learn about offline viewing options and content availability on MetsXMFanZone.",
    heading: "Download and Offline Viewing",
    bodyHtml: `
      <h2>Offline Viewing Options</h2>
      <p>MetsXMFanZone offers limited offline viewing capabilities through our Progressive Web App (PWA).</p>
      <h2>Installing the PWA</h2>
      <p>Install MetsXMFanZone as an app on your device for the best offline experience:</p>
      <h3>Mobile (iOS/Android)</h3>
      <ol><li>Visit metsxmfanzone.com in your mobile browser</li><li>Look for the "Add to Home Screen" or "Install App" prompt</li><li>Follow the installation instructions</li><li>Access the app from your home screen</li></ol>
      <h3>Desktop (Windows/Mac/Linux)</h3>
      <ol><li>Visit metsxmfanzone.com in Chrome, Edge, or other compatible browser</li><li>Look for the install icon in the address bar</li><li>Click "Install" to add to your desktop</li><li>Launch from your applications menu</li></ol>
      <h2>What Works Offline</h2>
      <ul><li>Previously loaded pages and content</li><li>Cached images and media</li><li>Basic navigation structure</li></ul>
      <h2>What Requires Internet</h2>
      <ul><li>Live streams and video playback</li><li>Real-time updates and new content</li><li>Community posts and comments</li><li>Account authentication</li></ul>
      <h2>Download Limitations</h2>
      <p><strong>Note:</strong> Due to licensing restrictions and streaming agreements, direct video downloads are not available. All video content must be streamed online with an active internet connection.</p>
      <h2>Improving Offline Experience</h2>
      <ul><li>Browse pages while online to cache content</li><li>Ensure you have a stable connection when loading new content</li><li>Keep the PWA updated for best performance</li></ul>`,
  },
  {
    path: "/help/playback-issues",
    title: "Troubleshooting Playback Issues",
    description: "Fix common video playback issues on MetsXMFanZone including buffering, loading errors, and quality problems.",
    heading: "Troubleshooting Playback Issues",
    bodyHtml: `
      <h2>Common Issues and Solutions</h2>
      <h3>Video Won't Load or Start</h3>
      <ul><li>Refresh the page</li><li>Clear your browser cache and cookies</li><li>Try a different browser</li><li>Disable browser extensions or ad blockers</li><li>Check if your subscription is active</li></ul>
      <h3>Constant Buffering</h3>
      <ul><li>Lower the video quality setting (see <a href="/help/video-quality">Video Quality Settings</a>)</li><li>Close other apps and browser tabs using bandwidth</li><li>Move closer to your WiFi router</li><li>Restart your router/modem</li><li>Test your internet speed (minimum 5 Mbps recommended)</li></ul>
      <h3>Poor Video Quality</h3>
      <ul><li>Manually select a higher quality setting (720p or 1080p)</li><li>Check your internet connection speed</li><li>Ensure quality setting isn't stuck on "Auto" with slow connection</li><li>Try watching at a different time when network traffic is lower</li></ul>
      <h3>Audio/Video Out of Sync</h3>
      <ul><li>Pause and resume the video</li><li>Refresh the page</li><li>Try a different browser</li><li>Clear browser cache</li></ul>
      <h3>Error Messages</h3>
      <ul>
        <li><strong>"Video unavailable":</strong> Stream may have ended or subscription required</li>
        <li><strong>"Playback error":</strong> Try refreshing or different browser</li>
        <li><strong>"Network error":</strong> Check internet connection</li>
        <li><strong>"Too many devices":</strong> You've exceeded the 2-device limit</li>
      </ul>
      <h2>Browser Compatibility</h2>
      <p>Recommended browsers: Google Chrome, Mozilla Firefox, Safari, Microsoft Edge (latest versions).</p>
      <h2>System Requirements</h2>
      <ul>
        <li><strong>Internet:</strong> Minimum 5 Mbps download speed</li>
        <li><strong>Browser:</strong> Latest version recommended</li>
        <li><strong>JavaScript:</strong> Must be enabled</li>
        <li><strong>Cookies:</strong> Must be enabled</li>
      </ul>
      <h2>Still Having Issues?</h2>
      <p>If problems persist after trying these solutions, please <a href="/contact">contact support</a> with a description of the issue, your browser/device information, any error messages, and your subscription plan.</p>`,
  },
  {
    path: "/help/post-community",
    title: "Posting in the Community",
    description: "Learn how to create posts and share content with fellow Mets fans in the MetsXMFanZone community.",
    heading: "Posting in the Community",
    bodyHtml: `
      <h2>Creating a Post</h2>
      <p>Share your thoughts and engage with fellow Mets fans:</p>
      <h3>Step 1: Navigate to Community</h3>
      <p>Click "Community" in the main navigation menu to access the community section.</p>
      <h3>Step 2: Create Your Post</h3>
      <ol><li>Click the "Create Post" button or text area</li><li>Write your message in the text field</li><li>Optionally, add an image by clicking the image icon</li><li>Click "Post" or "Submit" to publish</li></ol>
      <h2>Post Types</h2>
      <h3>Text Posts</h3>
      <ul><li>Share opinions, analysis, or discussion topics</li><li>Ask questions to the community</li><li>Start game day threads</li></ul>
      <h3>Image Posts</h3>
      <ul><li>Share photos from games or Mets events</li><li>Post memes and fan art</li><li>Show off your Mets memorabilia</li></ul>
      <h2>Best Practices</h2>
      <h3>Write Engaging Content</h3>
      <ul><li>Use clear, descriptive titles</li><li>Stay on topic (Mets and baseball related)</li><li>Add context and details</li><li>Proofread before posting</li></ul>
      <h3>Be Respectful</h3>
      <ul><li>Follow <a href="/help/community-guidelines">Community Guidelines</a></li><li>Avoid spam or duplicate posts</li><li>Don't post personal information</li><li>Credit sources when sharing news</li></ul>
      <h2>Editing and Deleting</h2>
      <h3>Edit Your Post</h3>
      <ol><li>Find your post in the community feed</li><li>Click the edit icon or three-dot menu</li><li>Select "Edit"</li><li>Make your changes and save</li></ol>
      <h3>Delete Your Post</h3>
      <ol><li>Find your post in the community feed</li><li>Click the three-dot menu</li><li>Select "Delete"</li><li>Confirm deletion</li></ol>
      <h2>Post Visibility</h2>
      <p>All posts are visible to logged-in community members with active accounts, displayed in chronological order with newest posts first.</p>
      <h2>Engagement</h2>
      <p>Learn how to interact with posts in our <a href="/help/comments-reactions">Commenting and Reactions</a> guide.</p>`,
  },
  {
    path: "/help/comments-reactions",
    title: "Commenting and Reactions",
    description: "Learn how to comment on posts, blog articles, and interact with content on MetsXMFanZone.",
    heading: "Commenting and Reactions",
    bodyHtml: `
      <h2>Adding Comments</h2>
      <p>Engage in discussions by commenting on posts and blog articles:</p>
      <h3>On Community Posts</h3>
      <ol><li>Navigate to the <a href="/community">Community</a> page</li><li>Find the post you want to comment on</li><li>Click in the comment text field below the post</li><li>Type your comment</li><li>Click "Post Comment" or press Enter</li></ol>
      <h3>On Blog Articles</h3>
      <ol><li>Read the blog article</li><li>Scroll to the comments section at the bottom</li><li>Click in the comment field</li><li>Write your thoughts</li><li>Submit your comment</li></ol>
      <h2>Comment Guidelines</h2>
      <h3>Do's</h3>
      <ul><li>Add value to the conversation</li><li>Be respectful of different opinions</li><li>Stay on topic</li><li>Use proper language</li><li>Engage constructively</li></ul>
      <h3>Don'ts</h3>
      <ul><li>Post spam or off-topic comments</li><li>Attack other users personally</li><li>Use offensive language</li><li>Share misinformation</li><li>Advertise without permission</li></ul>
      <h2>Managing Your Comments</h2>
      <h3>Edit a Comment</h3>
      <ol><li>Find your comment</li><li>Click the edit icon or three-dot menu</li><li>Select "Edit"</li><li>Make changes and save</li></ol>
      <h3>Delete a Comment</h3>
      <ol><li>Find your comment</li><li>Click the three-dot menu</li><li>Select "Delete"</li><li>Confirm deletion</li></ol>
      <h2>Reactions and Likes</h2>
      <ul><li>Click the like/heart icon on posts</li><li>React to comments you agree with</li><li>Your reactions are visible to other users</li></ul>
      <h2>Notifications</h2>
      <p>Get notified when someone replies to your comment, your post receives comments, or someone reacts to your content. Enable push notifications for real-time alerts.</p>
      <h2>Reporting Comments</h2>
      <p>If you see inappropriate comments, report them following our <a href="/help/report-content">Reporting Inappropriate Content</a> guide.</p>
      <h2>Community Standards</h2>
      <p>All comments must follow our <a href="/help/community-guidelines">Community Guidelines</a>. Violations may result in comment removal or account restrictions.</p>`,
  },
  {
    path: "/help/follow-fans",
    title: "Following Other Fans",
    description: "Learn how to connect with and follow other Mets fans on MetsXMFanZone.",
    heading: "Following Other Fans",
    bodyHtml: `
      <h2>Discovering Fans</h2>
      <p>Connect with fellow Mets supporters on MetsXMFanZone:</p>
      <h3>In the Community Feed</h3>
      <ul><li>Browse posts in the <a href="/community">Community</a> section</li><li>Click on usernames to view profiles</li><li>See posts, comments, and activity</li></ul>
      <h3>In Comments</h3>
      <ul><li>Engage with fans who comment on blog posts</li><li>Reply to comments you find interesting</li><li>Check out profiles of active community members</li></ul>
      <h2>Following Users</h2>
      <p>To follow another fan:</p>
      <ol><li>Navigate to their profile</li><li>Click the "Follow" button</li><li>You'll now see their activity in your feed</li></ol>
      <h2>Benefits of Following</h2>
      <ul><li>See posts from fans you follow in your personalized feed</li><li>Get notifications about their activity</li><li>Build a network of like-minded Mets supporters</li><li>Participate in focused discussions</li></ul>`,
  },
  {
    path: "/help/report-content",
    title: "Reporting Inappropriate Content",
    description: "Learn how to report inappropriate content, harassment, or policy violations on MetsXMFanZone.",
    heading: "Reporting Inappropriate Content",
    bodyHtml: `
      <h2>When to Report</h2>
      <p>Report content or behavior that violates our <a href="/help/community-guidelines">Community Guidelines</a>: harassment or bullying, hate speech or discrimination, spam or advertising, and inappropriate content.</p>
      <h2>How to Report</h2>
      <h3>Reporting Posts</h3>
      <ol><li>Find the post you want to report</li><li>Click the three-dot menu icon</li><li>Select "Report Post"</li><li>Choose the reason for reporting</li><li>Submit the report</li></ol>
      <h3>Reporting Comments</h3>
      <ol><li>Locate the inappropriate comment</li><li>Click the flag or report icon</li><li>Select the violation type</li><li>Submit your report</li></ol>
      <h2>Emergency Situations</h2>
      <p><strong>Important:</strong> If you encounter content involving immediate danger, threats of violence, or illegal activity, please contact local authorities immediately in addition to reporting on our platform.</p>`,
  },
  {
    path: "/help/update-profile",
    title: "Update Profile Information",
    description: "Learn how to update your profile information, avatar, and account settings on MetsXMFanZone.",
    heading: "Update Profile Information",
    bodyHtml: `
      <h2>Accessing Your Profile</h2>
      <p>To update your profile information:</p>
      <ol><li>Log in to your MetsXMFanZone account</li><li>Click on your profile icon or name in the top right</li><li>Select "Dashboard" or "Settings"</li><li>Navigate to the profile section</li></ol>
      <h2>Profile Information</h2>
      <h3>Full Name</h3>
      <ul><li>Update your display name</li><li>This appears on all your posts and comments</li></ul>
      <h3>Email Address</h3>
      <ul><li>Update your email for account notifications</li><li>Used for password recovery</li></ul>`,
  },
  {
    path: "/help/subscription-plans",
    title: "Subscription Plans Explained",
    description: "Compare MetsXMFanZone Free, Weekly, Monthly, and Yearly memberships.",
    heading: "Subscription Plans Explained",
    bodyHtml: `
      <h2>Available Plans</h2>
      <p>MetsXMFanZone offers four membership choices:</p>
      <h3>Free Plan — $0/month</h3>
      <ul><li>Access to all blog articles</li><li>Community posting and comments</li><li>No live game streams</li></ul>
      <h3>Weekly Plan — $3.99/week</h3>
      <ul><li>Everything in Free plan</li><li>Access to live streams and replays</li><li>Premium content and HD viewing</li></ul>
      <h3>Monthly Plan — $9.99/month</h3>
      <ul><li>Everything in Free plan</li><li>Access to all live game streams</li><li>HD and Full HD quality</li></ul>
      <h3>Yearly Plan — $129.99/year</h3>
      <ul><li>Everything in Monthly plan</li><li>One convenient yearly payment</li><li>Exclusive yearly member perks</li></ul>`,
  },
  {
    path: "/help/payment-methods",
    title: "Payment Methods",
    description: "Learn about accepted payment methods on MetsXMFanZone including PayPal.",
    heading: "Payment Methods",
    bodyHtml: `
      <h2>Accepted Payment Methods</h2>
      <p>MetsXMFanZone uses PayPal as our secure payment processor:</p>
      <h3>PayPal</h3>
      <ul><li>Pay with PayPal balance</li><li>Use credit/debit cards via PayPal</li><li>Secure recurring billing</li><li>Easy subscription management</li></ul>`,
  },
  {
    path: "/help/cancel-subscription",
    title: "Cancel or Change Subscription",
    description: "Learn how to cancel, downgrade, or upgrade your MetsXMFanZone subscription plan.",
    heading: "Cancel or Change Subscription",
    bodyHtml: `
      <h2>Canceling Your Subscription</h2>
      <p>You can cancel your Weekly, Monthly, or Yearly membership at any time.</p>
      <h3>For PayPal Subscriptions</h3>
      <ol><li>Log in to your PayPal account</li><li>Go to Settings → Payments</li><li>Click "Manage automatic payments"</li><li>Find "MetsXMFanZone" and select "Cancel"</li></ol>
      <h3>From your Member Center</h3>
      <ol><li>Log in to your MetsXMFanZone account</li><li>Go to your <a href="/dashboard">Member Center</a></li><li>Open membership settings</li><li>Select "Cancel membership"</li></ol>
      <h2>Refund Policy</h2>
      <p><strong>Important:</strong> We do not offer refunds for partial subscription periods. When you cancel, your subscription remains active until the end of your current billing cycle.</p>`,
  },
  {
    path: "/help/return-policy",
    title: "Return Policy",
    description: "Learn about MetsXMFanZone's return and refund policy for memberships and merchandise purchases.",
    heading: "Return Policy",
    bodyHtml: `
      <h2>Membership Subscription Plans</h2>
      <p>MetsXMFanZone membership plans are billed on a recurring basis (monthly or annually). Due to the nature of digital content and immediate access granted upon membership, we generally do not offer refunds for membership fees.</p>
      <p>However, we understand that special circumstances may arise. If you believe you're entitled to a refund, please contact our support team within 1 day of your purchase.</p>
      <h2>Cancellation Policy</h2>
      <p>You may cancel your membership subscription at any time through your account settings or by contacting support. Upon cancellation:</p>
      <ul>
        <li>You will not retain access to premium content if you cancel within 2 days</li>
        <li>No further charges will be made after the current period ends</li>
        <li>You can reactivate your subscription at any time</li>
      </ul>
      <p>Learn more about <a href="/help/cancel-subscription">how to cancel your membership subscription</a>.</p>
      <h2>Merchandise Returns</h2>
      <p>For physical merchandise purchased through our store:</p>
      <ul>
        <li>Returns are not accepted within 3 business days of delivery</li>
        <li>Items must be unworn, unused, and in original condition with tags attached</li>
        <li>Return shipping costs are the responsibility of the customer unless the item is defective</li>
        <li>No refunds unless you email us within 72 hours</li>
      </ul>
      <h2>Defective or Damaged Items</h2>
      <p>If you receive a defective or damaged item, please contact us immediately with photos of the issue. We will provide a replacement or full refund, including return shipping costs.</p>
      <h2>Processing Returns</h2>
      <ol>
        <li>Contact our support team via the <a href="/contact">contact page</a></li>
        <li>Provide your order number and reason for return</li>
        <li>Wait for return authorization and instructions</li>
        <li>Ship the item back using the provided instructions</li>
      </ol>
      <h2>Questions?</h2>
      <p>If you have any questions about our return policy or need assistance with a return, please don't hesitate to <a href="/contact">contact our support team</a>. We're here to help!</p>`,
  },
].map(helpArticle);

// ---------------------------------------------------------------------------
// Help Center hub
// ---------------------------------------------------------------------------
const helpCenter = {
  path: "/help-center",
  async render(root, ctx) {
    setPageMetadata({
      title: "Help Center - Support & Resources | MetsXMFanZone",
      description: "Get help with MetsXMFanZone. Browse guides, tutorials, and resources for streaming, account management, troubleshooting, and more.",
      path: ctx?.pathname || "/help-center",
    });

    const categories = [
      {
        title: "Getting Started",
        description: "Learn the basics of MetsXMFanZone",
        articles: [
          ["How to create an account", "/help/create-account"],
          ["Navigating the platform", "/help/navigate-platform"],
          ["Watching live streams", "/help/watch-streams"],
          ["Community guidelines", "/help/community-guidelines"],
        ],
      },
      {
        title: "Streaming & Content",
        description: "Everything about our video content",
        articles: [
          ["Video quality settings", "/help/video-quality"],
          ["Accessing premium content", "/help/premium-content"],
          ["Download and offline viewing", "/help/offline-viewing"],
          ["Troubleshooting playback issues", "/help/playback-issues"],
        ],
      },
      {
        title: "Community & Engagement",
        description: "Connect with other fans",
        articles: [
          ["Posting in the community", "/help/post-community"],
          ["Commenting and reactions", "/help/comments-reactions"],
          ["Following other fans", "/help/follow-fans"],
          ["Reporting inappropriate content", "/help/report-content"],
        ],
      },
      {
        title: "Account & Billing",
        description: "Manage your account and subscriptions",
        articles: [
          ["Update profile information", "/help/update-profile"],
          ["Subscription plans explained", "/help/subscription-plans"],
          ["Payment methods", "/help/payment-methods"],
          ["Cancel or change subscription", "/help/cancel-subscription"],
          ["Return policy", "/help/return-policy"],
        ],
      },
    ];

    const content = `
      <section class="content-width page-heading">
        <p class="eyebrow">Support</p>
        <h1>Help Center</h1>
        <p>Find answers to your questions and learn how to get the most out of MetsXMFanZone.</p>
      </section>
      <section class="content-width">
        <div class="help-grid">
          ${categories
            .map(
              (category) => `
            <div class="help-category">
              <h2>${escapeHtml(category.title)}</h2>
              <p>${escapeHtml(category.description)}</p>
              <ul>
                ${category.articles
                  .map(([label, href]) => `<li><a href="${href}">• ${escapeHtml(label)}</a></li>`)
                  .join("")}
              </ul>
            </div>`,
            )
            .join("")}
        </div>
      </section>`;

    mount(root, ctx?.pathname || "/help-center", content);
  },
};

// ---------------------------------------------------------------------------
// FAQs (with contact form -> contact_submissions)
// ---------------------------------------------------------------------------
const faqData = [
  ["What is MetsXMFanZone?", "MetsXMFanZone is your ultimate destination for exclusive New York Mets content, including live streams, game highlights, community discussions, and in-depth analysis."],
  ["How do I watch live streams?", "Navigate to the Live section from the main menu or click on any live stream card on the homepage. Premium subscribers get access to all live content."],
  ["What's the difference between Free and Premium plans?", "Free plan gives you basic access to highlights and community features. Premium ($9.99/month) unlocks all live streams, full game replays, HD quality, ad-free experience, and exclusive content. Annual plan ($129.99/year) includes everything in Premium plus 2 months free savings."],
  ["Can I switch between monthly and yearly billing?", "Yes! You can switch between monthly and annual billing anytime from your account settings. When you switch to annual, you'll save the equivalent of 2 months compared to monthly billing."],
  ["What payment methods do you accept?", "We accept PayPal and all major credit/debit cards through our secure payment processing partners."],
  ["Can I cancel my subscription anytime?", "Yes! You can cancel your subscription at any time from your account settings. Your access will continue until the end of your billing period."],
  ["How do I join the community?", "Create a free account and head to the Community section. You can post, comment, and engage with other Mets fans instantly."],
  ["Is there a mobile app?", "Yes! Our website is fully responsive and works great on mobile browsers. You can also add it to your home screen for an app-like experience using PWA technology."],
  ["How often is new content added?", "We add new content daily, including game highlights, analysis videos, blog posts, and live streams during the baseball season."],
  ["Can I watch on multiple devices?", "Premium and Annual plans allow streaming on up to 2 devices simultaneously. Accounts found accessing from more than 2 devices may face restrictions."],
  ["What happens to my unused access?", "Your subscription access remains valid until the end of your billing period. If you cancel, you can continue using premium features until that date."],
  ["How do I report inappropriate content?", "Use the report button on any post or comment. Our moderation team reviews all reports within 24 hours."],
  ["Are there any blackouts on MetsXMFanZone streams?", "No! There are absolutely no blackouts on any of our streams. You can watch every game without restrictions. If there is ever a rare schedule change or stream update, we will announce it on our Social Wall or on our official social media channels — so make sure to follow us to stay informed."],
];

const faqs = {
  path: "/faqs",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/faqs";
    setPageMetadata({
      title: "Frequently Asked Questions - Help & Support | MetsXMFanZone",
      description: "Find answers to common questions about MetsXMFanZone subscriptions, live streams, content access, and more. Get help with your account and features.",
      path: pathname,
    });

    const content = `
      <section class="content-width page-heading">
        <h1>Frequently Asked Questions</h1>
        <p>Find quick answers to common questions about MetsXMFanZone</p>
      </section>
      <section class="content-width">
        <div class="faq-list">
          ${faqData
            .map(
              ([question, answer]) => `
            <details class="faq-item">
              <summary>${escapeHtml(question)}</summary>
              <p>${escapeHtml(answer)}</p>
            </details>`,
            )
            .join("")}
        </div>
        <div class="card-panel" style="max-width:560px;margin-inline:auto 40px">
          <h2>Still Have Questions?</h2>
          <p>Send us a message and we'll get back to you as soon as possible.</p>
          <form class="stacked-form" id="faq-contact-form">
            <label>Name *<input type="text" name="name" maxlength="100" required></label>
            <label>Email *<input type="email" name="email" maxlength="255" required></label>
            <label>Subject<input type="text" name="subject" maxlength="200"></label>
            <label>Message *<textarea name="message" rows="5" maxlength="1000" required></textarea></label>
            <p class="form-error" id="faq-contact-error" hidden role="alert"></p>
            <button class="button primary" type="submit">Submit Question</button>
          </form>
        </div>
      </section>`;

    mount(root, pathname, content);

    const form = root.querySelector("#faq-contact-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = root.querySelector("#faq-contact-error");
      const submit = form.querySelector("button[type=submit]");
      const data = Object.fromEntries(new FormData(form).entries());
      if (!String(data.name || "").trim() || !String(data.email || "").trim() || !String(data.message || "").trim()) {
        error.textContent = "Please fill in all required fields.";
        error.hidden = false;
        return;
      }

      submit.disabled = true;
      error.hidden = true;
      const { user } = auth.state;
      const { error: insertError } = await backend.from("contact_submissions").insert({
        name: String(data.name).trim(),
        email: String(data.email).trim(),
        subject: String(data.subject || "").trim() || null,
        message: String(data.message).trim(),
        user_id: user?.id || null,
      });

      if (insertError) {
        error.textContent = insertError.message || "Failed to submit. Please try again.";
        error.hidden = false;
      } else {
        form.reset();
        submit.textContent = "Sent!";
        setTimeout(() => {
          submit.textContent = "Submit Question";
        }, 2500);
      }
      submit.disabled = false;
    });
  },
};

// ---------------------------------------------------------------------------
// Privacy & Terms (static legal copy)
// ---------------------------------------------------------------------------
const privacy = {
  path: "/privacy",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/privacy";
    setPageMetadata({
      title: "Privacy Policy - MetsXMFanZone Data Protection & Privacy",
      description: "Read MetsXMFanZone's privacy policy to understand how we collect, use, and protect your personal information and data.",
      path: pathname,
    });

    const updated = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());

    const content = `
      <section class="content-width article">
        <div class="card-panel" style="max-width:850px">
          <h1>Privacy Policy</h1>
          <p class="form-note">Last updated: ${escapeHtml(updated)}</p>
          <div class="article-body">
            <h2>Introduction</h2>
            <p>Welcome to MetsXMFanZone. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our platform.</p>
            <h2>Information We Collect</h2>
            <p>We collect several types of information:</p>
            <ul>
              <li>Personal identification information (name, email address, phone number)</li>
              <li>Payment and billing information</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Cookies and tracking technologies</li>
            </ul>
            <h2>How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and maintain our services</li>
              <li>Process payments and subscriptions</li>
              <li>Send you updates, newsletters, and promotional content</li>
              <li>Improve user experience and platform functionality</li>
              <li>Detect and prevent fraud or security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
            <h2>Data Security</h2>
            <p>We implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits. However, no method of transmission over the internet is 100% secure.</p>
            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Export your data</li>
            </ul>
            <h2>Third-Party Services</h2>
            <p>We may use third-party services for analytics, payment processing, and content delivery. These services have their own privacy policies and we encourage you to review them.</p>
            <h2>Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@metsxmfanzone.com">privacy@metsxmfanzone.com</a></p>
          </div>
        </div>
      </section>`;

    mount(root, pathname, content);
  },
};

const terms = {
  path: "/terms",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/terms";
    setPageMetadata({
      title: "Terms of Service - MetsXMFanZone User Agreement",
      description: "Review MetsXMFanZone's terms of service and user agreement. Understand your rights and responsibilities when using our platform.",
      path: pathname,
    });

    const updated = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());

    const content = `
      <section class="content-width article">
        <div class="card-panel" style="max-width:850px">
          <h1>Terms of Service</h1>
          <p class="form-note">Last updated: ${escapeHtml(updated)}</p>
          <div class="article-body">
            <h2>Agreement to Terms</h2>
            <p>By accessing MetsXMFanZone, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this site.</p>
            <h2>Use License</h2>
            <p>Permission is granted to temporarily access the materials on MetsXMFanZone for personal, non-commercial viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
            <ul>
              <li>Modify or copy the materials</li>
              <li>Use the materials for commercial purposes</li>
              <li>Attempt to reverse engineer any software</li>
              <li>Remove copyright or proprietary notations</li>
              <li>Transfer materials to another person</li>
            </ul>
            <h2>User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.</p>
            <h2>Subscriptions and Payments</h2>
            <p>Subscription fees are billed in advance on a recurring basis. You can cancel at any time, but refunds are not provided for partial billing periods. We reserve the right to modify subscription prices with 30 days notice.</p>
            <h2>Content Guidelines</h2>
            <p>Users must not post content that:</p>
            <ul>
              <li>Violates any laws or regulations</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains hate speech or harassment</li>
              <li>Promotes violence or illegal activities</li>
              <li>Contains spam or misleading information</li>
            </ul>
            <h2>Intellectual Property</h2>
            <p>All content, trademarks, and data on this platform, including but not limited to software, databases, text, graphics, icons, and hyperlinks, are the property of MetsXMFanZone and are protected by law.</p>
            <h2>Limitation of Liability</h2>
            <p>MetsXMFanZone shall not be liable for any damages arising from the use or inability to use our services, including but not limited to direct, indirect, incidental, punitive, and consequential damages.</p>
            <h2>Termination</h2>
            <p>We reserve the right to terminate or suspend your account and access to our services at our sole discretion, without notice, for conduct that violates these Terms or is harmful to other users.</p>
            <h2>Changes to Terms</h2>
            <p>We may revise these Terms at any time. By continuing to use MetsXMFanZone after changes are posted, you agree to be bound by the revised terms.</p>
            <h2>Contact Information</h2>
            <p>Questions about the Terms of Service should be sent to <a href="mailto:legal@metsxmfanzone.com">legal@metsxmfanzone.com</a></p>
          </div>
        </div>
      </section>`;

    mount(root, pathname, content);
  },
};

// ---------------------------------------------------------------------------
// Contact (real insert -> contact_submissions)
// ---------------------------------------------------------------------------
const contact = {
  path: "/contact",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/contact";
    setPageMetadata({
      title: "Contact MetsXMFanZone - Get in Touch",
      description: "Contact MetsXMFanZone for support, feedback, or questions. We're here to help Mets fans with subscriptions, content, and more.",
      path: pathname,
    });

    const content = `
      <section class="content-width page-heading">
        <h1>Contact Us</h1>
        <p>Have a question or feedback? We'd love to hear from you.</p>
      </section>
      <section class="content-width" style="display:grid;gap:20px;grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start">
        <div class="card-panel">
          <h2>Send us a message</h2>
          <p class="form-note">Fill out the form below and we'll respond within 24 hours</p>
          <form class="stacked-form" id="contact-form" style="max-width:none">
            <label>Name<input type="text" name="name" required></label>
            <label>Email<input type="email" name="email" required></label>
            <label>Subject<input type="text" name="subject" required></label>
            <label>Message<textarea name="message" rows="6" required></textarea></label>
            <p class="form-error" id="contact-error" hidden role="alert"></p>
            <button class="button primary" type="submit">Send Message</button>
          </form>
        </div>
        <div style="display:grid;gap:14px">
          <div class="card-panel"><h2>Email</h2><p class="form-note">support@metsxmfanzone.com</p></div>
          <div class="card-panel"><h2>Phone</h2><p class="form-note">1-800-METS-FAN</p></div>
          <div class="card-panel"><h2>Address</h2><p class="form-note">123 Baseball Ave<br>New York, NY 10001</p></div>
        </div>
      </section>`;

    mount(root, pathname, content);

    const form = root.querySelector("#contact-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = root.querySelector("#contact-error");
      const submit = form.querySelector("button[type=submit]");
      const data = Object.fromEntries(new FormData(form).entries());

      submit.disabled = true;
      submit.textContent = "Sending...";
      error.hidden = true;

      const { user } = auth.state;
      const { error: insertError } = await backend.from("contact_submissions").insert({
        name: String(data.name || "").trim(),
        email: String(data.email || "").trim(),
        subject: String(data.subject || "").trim() || null,
        message: String(data.message || "").trim(),
        user_id: user?.id || null,
      });

      if (insertError) {
        error.textContent = insertError.message || "Message could not be sent. Please try again.";
        error.hidden = false;
        submit.textContent = "Send Message";
      } else {
        form.reset();
        submit.textContent = "Message sent!";
        setTimeout(() => {
          submit.textContent = "Send Message";
        }, 2500);
      }
      submit.disabled = false;
    });
  },
};

// ---------------------------------------------------------------------------
// Feedback (insert -> feedbacks, requires auth)
// ---------------------------------------------------------------------------
const feedback = {
  path: "/feedback",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/feedback";
    setPageMetadata({
      title: "Share Your Feedback - Help Us Improve",
      description: "Share your feedback and suggestions with MetsXMFanZone. Help us improve your experience and make the platform better for all Mets fans.",
      path: pathname,
    });

    const content = `
      <section class="content-width" style="padding-block:32px 60px;max-width:640px;margin-inline:auto">
        <div class="card-panel">
          <h1>Share Your Feedback</h1>
          <p class="form-note">Let us know what you think! Your feedback helps us improve.</p>
          <form class="stacked-form" id="feedback-form" style="max-width:none">
            <label>Rating (Optional)
              <div class="rating-stars" role="radiogroup" aria-label="Rating">
                ${[1, 2, 3, 4, 5].map((star) => `<button type="button" data-star="${star}" aria-label="${star} star">★</button>`).join("")}
              </div>
            </label>
            <input type="hidden" name="rating" value="0">
            <label>Your Feedback *<textarea name="content" rows="6" required placeholder="Tell us what you think..."></textarea></label>
            <p class="form-error" id="feedback-error" hidden role="alert"></p>
            <button class="button primary" type="submit">Submit Feedback</button>
          </form>
        </div>
      </section>`;

    mount(root, pathname, content);

    const form = root.querySelector("#feedback-form");
    const ratingInput = form.querySelector("input[name=rating]");
    const stars = [...form.querySelectorAll(".rating-stars button")];
    const paintStars = (value) => stars.forEach((star) => star.classList.toggle("is-active", Number(star.dataset.star) <= value));
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        ratingInput.value = star.dataset.star;
        paintStars(Number(star.dataset.star));
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = root.querySelector("#feedback-error");
      const submit = form.querySelector("button[type=submit]");
      const content = form.querySelector("textarea[name=content]").value.trim();
      const rating = Number(ratingInput.value) || 0;

      const { user } = await auth.ready();
      if (!user) {
        window.location.assign("/auth");
        return;
      }
      if (!content) {
        error.textContent = "Please write your feedback before submitting.";
        error.hidden = false;
        return;
      }

      submit.disabled = true;
      error.hidden = true;
      const { error: insertError } = await backend.from("feedbacks").insert({
        user_id: user.id,
        content,
        rating: rating > 0 ? rating : null,
      });

      if (insertError) {
        error.textContent = insertError.message || "Failed to submit feedback. Please try again.";
        error.hidden = false;
      } else {
        form.reset();
        ratingInput.value = "0";
        paintStars(0);
        submit.textContent = "Thank you!";
        setTimeout(() => {
          submit.textContent = "Submit Feedback";
        }, 2500);
      }
      submit.disabled = false;
    });
  },
};

// ---------------------------------------------------------------------------
// Business Partner (insert -> business_ads)
// ---------------------------------------------------------------------------
const businessPartner = {
  path: "/business-partner",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/business-partner";
    setPageMetadata({
      title: "Business Advertisement | MetsXMFanZone",
      description: "Advertise your business to thousands of engaged Mets fans through MetsXMFanZone's community advertising program.",
      path: pathname,
    });

    const benefits = [
      ["Reach Thousands of Fans", "Connect with our engaged community of passionate Mets fans"],
      ["Boost Your Brand", "Increase visibility and brand awareness in the sports community"],
      ["Targeted Marketing", "Reach your ideal audience with precision marketing opportunities"],
    ];

    const content = `
      <section class="content-width page-heading">
        <h1>Business Advertisement</h1>
        <p>Advertise your business to thousands of engaged Mets fans</p>
      </section>
      <section class="content-width">
        <div class="benefit-grid">
          ${benefits.map(([title, description]) => `<div class="benefit-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`).join("")}
        </div>
      </section>
      <section class="content-width" style="max-width:720px;margin-inline:auto 60px">
        <div class="card-panel">
          <h2>Submit Your Business Ad</h2>
          <p class="form-note">Fill out the form below to submit your advertisement for admin approval</p>
          <form class="stacked-form" id="business-form" style="max-width:none">
            <label>Business Name *<input type="text" name="businessName" required></label>
            <label>Ad Title *<input type="text" name="adTitle" required></label>
            <label>Ad Description *<textarea name="adDescription" rows="4" required></textarea></label>
            <label>Ad Image URL (Optional)<input type="url" name="adImageUrl" placeholder="https://..."></label>
            <label>Contact Email *<input type="email" name="contactEmail" required></label>
            <label>Contact Phone<input type="tel" name="contactPhone"></label>
            <label>Website URL<input type="url" name="websiteUrl" placeholder="https://yourbusiness.com"></label>
            <p class="form-error" id="business-error" hidden role="alert"></p>
            <button class="button primary" type="submit">Submit Ad for Review</button>
          </form>
        </div>
      </section>`;

    mount(root, pathname, content);

    const form = root.querySelector("#business-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = root.querySelector("#business-error");
      const submit = form.querySelector("button[type=submit]");
      const { user } = await auth.ready();
      if (!user) {
        window.location.assign("/auth");
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      error.hidden = true;
      const { error: insertError } = await backend.from("business_ads").insert({
        user_id: user.id,
        business_name: String(data.businessName || "").trim(),
        ad_title: String(data.adTitle || "").trim(),
        ad_description: String(data.adDescription || "").trim(),
        ad_image_url: String(data.adImageUrl || "").trim() || null,
        contact_email: String(data.contactEmail || "").trim(),
        contact_phone: String(data.contactPhone || "").trim() || null,
        website_url: String(data.websiteUrl || "").trim() || null,
        status: "pending",
      });

      if (insertError) {
        error.textContent = insertError.message || "Failed to submit business ad.";
        error.hidden = false;
      } else {
        form.reset();
        submit.textContent = "Submitted!";
        setTimeout(() => {
          submit.textContent = "Submit Ad for Review";
        }, 2500);
      }
      submit.disabled = false;
    });
  },
};

// ---------------------------------------------------------------------------
// Podcaster Application (insert -> podcaster_applications)
// ---------------------------------------------------------------------------
const podcasterApplication = {
  path: "/podcaster-application",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/podcaster-application";
    setPageMetadata({
      title: "Become a Podcaster | MetsXMFanZone",
      description: "Join the MetsXMFanZone podcast network. Apply to become a podcaster and share your Mets passion with thousands of fans.",
      path: pathname,
    });

    const benefits = [
      ["Professional Platform", "Access to our established podcast network and audience"],
      ["Live Streaming", "Stream live to thousands of engaged Mets fans"],
      ["Community Access", "Connect with passionate fans and fellow podcasters"],
      ["Flexible Schedule", "Choose your own streaming times and format"],
    ];

    mount(
      root,
      pathname,
      `<section class="content-width status-panel"><h1>Loading…</h1></section>`,
    );

    const { user } = await auth.ready();
    let existingApplication = null;
    let profile = null;
    if (user) {
      const [{ data: application }, { data: profileData }] = await Promise.all([
        backend
          .from("podcaster_applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        backend.from("profiles").select("full_name,email").eq("id", user.id).single(),
      ]);
      existingApplication = application || null;
      profile = profileData || null;
    }

    const statusBadge = (status) => {
      if (status === "approved") return '<span class="status-badge is-approved">Approved</span>';
      if (status === "rejected") return '<span class="status-badge is-rejected">Not Approved</span>';
      return '<span class="status-badge is-pending">Pending Review</span>';
    };

    const formOrStatus = existingApplication
      ? `<div class="card-panel" style="max-width:640px;margin-inline:auto">
          <h2>Application Submitted</h2>
          <p class="form-note">Your podcaster application is being reviewed</p>
          <dl class="detail-list">
            <div><dt>Status</dt><dd>${statusBadge(existingApplication.status)}</dd></div>
            <div><dt>Submitted</dt><dd>${escapeHtml(new Date(existingApplication.created_at).toLocaleDateString())}</dd></div>
            <div><dt>Topic</dt><dd>${escapeHtml(existingApplication.podcast_topic || "")}</dd></div>
          </dl>
          ${existingApplication.status === "rejected" ? '<p class="form-note">You can submit a new application with updated information.</p>' : ""}
        </div>`
      : `<div class="card-panel" style="max-width:640px;margin-inline:auto">
          <h2>Apply to Become a Podcaster</h2>
          <p class="form-note">Join MetsXMFanZone and Orange and Blue Media podcast network</p>
          ${!user ? `<p class="form-note">Please <a href="/auth">sign in</a> to submit an application</p>` : ""}
          <form class="stacked-form" id="podcaster-form" style="max-width:none">
            <label>Full Name *<input type="text" name="full_name" value="${escapeHtml(profile?.full_name || "")}" required></label>
            <label>Email *<input type="email" name="email" value="${escapeHtml(profile?.email || user?.email || "")}" required></label>
            <label>Phone Number<input type="tel" name="phone"></label>
            <label>Podcast Topic/Focus *<input type="text" name="podcast_topic" placeholder="e.g., Game analysis, Player interviews" required></label>
            <label>Podcasting/Broadcasting Experience<textarea name="experience" rows="3"></textarea></label>
            <label>Sample Content URL<input type="url" name="sample_url" placeholder="https://..."></label>
            <label>Equipment Description<textarea name="equipment_description" rows="2"></textarea></label>
            <label>Availability<input type="text" name="availability" placeholder="e.g., Weekday evenings"></label>
            <label>Social Media Links<textarea name="social_links" rows="2"></textarea></label>
            <p class="form-error" id="podcaster-error" hidden role="alert"></p>
            <button class="button primary" type="submit" ${user ? "" : "disabled"}>Submit Application</button>
          </form>
        </div>`;

    const content = `
      <section class="content-width page-heading">
        <p class="eyebrow">Join Our Podcast Network</p>
        <h1>Become a MetsXMFanZone Podcaster</h1>
        <p>Share your passion for Mets baseball with MetsXMFanZone and Orange and Blue Media. Join our lineup of content creators and reach thousands of engaged fans.</p>
      </section>
      <section class="content-width">
        <div class="benefit-grid">
          ${benefits.map(([title, description]) => `<div class="benefit-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`).join("")}
        </div>
      </section>
      <section class="content-width" style="padding-bottom:60px">${formOrStatus}</section>`;

    mount(root, pathname, content);

    const form = root.querySelector("#podcaster-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = root.querySelector("#podcaster-error");
      const submit = form.querySelector("button[type=submit]");
      const { user: currentUser } = auth.state;
      if (!currentUser) {
        window.location.assign("/auth");
        return;
      }
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.full_name || !data.email || !data.podcast_topic) {
        error.textContent = "Please fill in your name, email, and podcast topic.";
        error.hidden = false;
        return;
      }

      submit.disabled = true;
      error.hidden = true;
      const { error: insertError } = await backend.from("podcaster_applications").insert({
        user_id: currentUser.id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        experience: data.experience || null,
        podcast_topic: data.podcast_topic,
        sample_url: data.sample_url || null,
        equipment_description: data.equipment_description || null,
        availability: data.availability || null,
        social_links: data.social_links || null,
      });

      if (insertError) {
        error.textContent = insertError.message || "Failed to submit application.";
        error.hidden = false;
        submit.disabled = false;
      } else {
        podcasterApplication.render(root, ctx);
      }
    });
  },
};

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------
const install = {
  path: "/install",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/install";
    setPageMetadata({
      title: "Install MetsXMFanZone App - Mobile, Desktop & TV",
      description: "Install MetsXMFanZone on your phone, computer, or smart TV for the best Mets fan experience with offline access and push notifications.",
      path: pathname,
    });

    const features = [
      ["Lightning Fast", "Loads instantly, even on slow networks"],
      ["Works Offline", "Access cached content without internet"],
      ["Push Notifications", "Get alerts for live games and updates"],
      ["Full Screen", "Immersive experience without browser UI"],
    ];

    const content = `
      <section class="content-width page-heading">
        <p class="eyebrow">Install the App</p>
        <h1>Get MetsXMFanZone on Any Device</h1>
        <p>Install our app for a faster, fuller experience with offline access, push notifications, and instant updates.</p>
      </section>
      <section class="content-width">
        <div class="benefit-grid">
          ${features.map(([title, description]) => `<div class="benefit-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`).join("")}
        </div>
        <div class="install-tabs">
          <div class="install-tab">
            <h2>iPhone / iPad</h2>
            <p class="form-note">Safari on iOS doesn't show an install button, but you can add MetsXMFanZone to your home screen:</p>
            <ol>
              <li>Open metsxmfanzone.com in Safari (not Chrome or another browser)</li>
              <li>Tap the Share icon at the bottom of the screen</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right corner to confirm</li>
            </ol>
          </div>
          <div class="install-tab">
            <h2>Android</h2>
            <p class="form-note">Get the native Android app directly, or install the browser PWA from Chrome:</p>
            <ol>
              <li>Open metsxmfanzone.com in Google Chrome</li>
              <li>Tap the three-dot menu in the top right corner</li>
              <li>Select "Install app" or "Add to Home screen"</li>
              <li>Tap "Install" to confirm</li>
            </ol>
          </div>
          <div class="install-tab">
            <h2>Desktop (Windows, Mac, Linux)</h2>
            <p class="form-note">Install MetsXMFanZone as a desktop app using Chrome or Edge:</p>
            <ol>
              <li>Visit metsxmfanzone.com in Chrome or Edge</li>
              <li>Look for the install icon in the address bar</li>
              <li>Click "Install" and confirm</li>
              <li>Launch it from your desktop or start menu</li>
            </ol>
          </div>
          <div class="install-tab">
            <h2>Smart TV</h2>
            <p class="form-note">Open metsxmfanzone.com in your TV's built-in web browser and add it to your home screen or bookmarks for quick access.</p>
          </div>
        </div>
      </section>`;

    mount(root, pathname, content);
  },
};

// ---------------------------------------------------------------------------
// What's New
// ---------------------------------------------------------------------------
const staticUpdates = [
  ["feature", "Welcome Back Toast", "Returning users now see a personalized welcome message highlighting new content since their last visit.", "2026-01-08"],
  ["feature", "Daily Admin Reports", "Admins can now view daily reports with user activity and content statistics.", "2026-01-08"],
  ["improvement", "Enhanced Podcast Section", "Streamlined podcast section with improved layout and removed redundant team join button.", "2026-01-07"],
  ["coming-soon", "Push Notification Improvements", "Working on enhanced push notifications for game alerts and live stream reminders.", "2026-01-08"],
  ["coming-soon", "Community Polls", "Interactive polls for community engagement and fan opinions on games and players.", "2026-01-08"],
];

const whatsNew = {
  path: "/whats-new",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/whats-new";
    setPageMetadata({
      title: "What's New - Latest Updates & Features",
      description: "Stay up to date with the latest MetsXMFanZone features, improvements, and content updates. See what's new on the platform.",
      path: pathname,
    });

    mount(root, pathname, `<section class="content-width status-panel"><h1>Loading…</h1></section>`);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [blogRes, podcastRes, streamRes] = await Promise.all([
      backend.from("blog_posts").select("id,title,created_at").eq("published", true).gte("created_at", oneWeekAgo.toISOString()).order("created_at", { ascending: false }).limit(5),
      backend.from("podcasts").select("id,title,created_at").eq("published", true).gte("created_at", oneWeekAgo.toISOString()).order("created_at", { ascending: false }).limit(5),
      backend.from("live_streams").select("id,title,created_at").eq("published", true).gte("created_at", oneWeekAgo.toISOString()).order("created_at", { ascending: false }).limit(5),
    ]);

    const dynamicUpdates = [];
    (blogRes.data || []).forEach((post) => dynamicUpdates.push(["feature", `New Blog: ${post.title}`, "A new blog post has been published for the community.", post.created_at.split("T")[0]]));
    (podcastRes.data || []).forEach((podcast) => dynamicUpdates.push(["feature", `New Episode: ${podcast.title}`, "A new podcast episode is now available to listen.", podcast.created_at.split("T")[0]]));
    (streamRes.data || []).forEach((stream) => dynamicUpdates.push(["feature", `New Stream: ${stream.title}`, "A new live stream has been added to the schedule.", stream.created_at.split("T")[0]]));

    const allUpdates = [...dynamicUpdates, ...staticUpdates].sort((a, b) => new Date(b[3]).getTime() - new Date(a[3]).getTime());
    const comingSoon = staticUpdates.filter(([type]) => type === "coming-soon");
    const timeline = allUpdates.filter(([type]) => type !== "coming-soon");

    const typeLabel = { feature: "New Feature", improvement: "Improvement", fix: "Bug Fix" };

    const content = `
      <section class="content-width page-heading">
        <p class="eyebrow">Changelog</p>
        <h1>What's New</h1>
        <p>Stay up to date with the latest features, improvements, and content updates.</p>
      </section>
      <section class="content-width">
        <h2 class="section-title">Currently Working On</h2>
        ${comingSoon
          .map(
            ([, title, description]) => `
          <div class="timeline-item">
            <div><strong>${escapeHtml(title)}</strong> <span class="status-badge is-pending">In Progress</span></div>
            <p class="form-note">${escapeHtml(description)}</p>
          </div>`,
          )
          .join("")}
        <h2 class="section-title" style="margin-top:30px">Timeline</h2>
        ${timeline
          .map(
            ([type, title, description, date]) => `
          <div class="timeline-item">
            <time>${escapeHtml(new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(date)))}</time>
            <div><strong>${escapeHtml(title)}</strong> <span class="status-badge is-approved">${escapeHtml(typeLabel[type] || "Update")}</span></div>
            <p class="form-note">${escapeHtml(description)}</p>
          </div>`,
          )
          .join("")}
      </section>`;

    mount(root, pathname, content);
  },
};

// ---------------------------------------------------------------------------
// Social Media Hub
// ---------------------------------------------------------------------------
const socialLinks = {
  facebook: "https://www.facebook.com/metsxmfanzoneofficial",
  instagram: "https://www.instagram.com/metsxmfanzone",
  twitter: "https://twitter.com/metsxmfanzone",
  tiktok: "https://www.tiktok.com/@metsxmfanzone",
};

const socialMediaHub = {
  path: "/social",
  async render(root, ctx) {
    const pathname = ctx?.pathname || "/social";
    setPageMetadata({
      title: "Follow MetsXMFanZone on Social Media",
      description: "Follow MetsXMFanZone on all social media platforms. Stay connected with the latest Mets news, updates, and community content.",
      path: pathname,
    });

    const platforms = [
      ["Facebook", socialLinks.facebook],
      ["Instagram", socialLinks.instagram],
      ["X (Twitter)", socialLinks.twitter],
      ["TikTok", socialLinks.tiktok],
    ];

    const content = `
      <section class="content-width page-heading">
        <h1>Follow MetsXMFanZone</h1>
        <p>Stay connected with us across all platforms for the latest Mets news, highlights, and community content.</p>
      </section>
      <section class="content-width">
        <div class="hero-actions" style="margin-bottom:24px">
          ${platforms.map(([label, href]) => `<a class="button secondary" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).join("")}
        </div>
        <div class="social-grid">
          ${platforms
            .map(
              ([label, href]) => `
            <div class="social-card">
              <strong>${escapeHtml(label)}</strong>
              <p class="form-note">@metsxmfanzone</p>
              <a class="button primary" href="${href}" target="_blank" rel="noopener noreferrer">Follow on ${escapeHtml(label)}</a>
            </div>`,
            )
            .join("")}
        </div>
        <div class="card-panel" style="text-align:center;max-width:640px;margin:20px auto 60px">
          <h2>Join the MetsXMFanZone Community</h2>
          <p class="form-note">Connect with fellow Mets fans, get instant updates, and never miss a moment of the action!</p>
        </div>
      </section>`;

    mount(root, pathname, content);
  },
};

export const helpRoutes = [
  helpCenter,
  faqs,
  privacy,
  terms,
  contact,
  feedback,
  businessPartner,
  podcasterApplication,
  install,
  whatsNew,
  socialMediaHub,
  ...helpArticles,
];
