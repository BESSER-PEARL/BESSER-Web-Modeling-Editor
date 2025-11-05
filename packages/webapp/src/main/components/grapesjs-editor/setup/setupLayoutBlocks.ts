import { Editor } from 'grapesjs';

/**
 * Setup layout blocks (containers, grids, flexbox, sections)
 */
export function setupLayoutBlocks(editor: Editor) {
  const bm = editor.BlockManager;
  
  // Container Block
  bm.add('container', {
    label: 'Container',
    category: 'Layout',
    content: `
      <div class="container" style="max-width: 1200px; margin: 0 auto; padding: 20px;">
        <p>Container - drag content here</p>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Section Block
  bm.add('section', {
    label: 'Section',
    category: 'Layout',
    content: `
      <section style="padding: 60px 0; background: #f5f5f5;">
        <div style="max-width: 1200px; margin: 0 auto; padding: 0 20px;">
          <h2>Section Title</h2>
          <p>Section content goes here</p>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="6" width="20" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // 4 Column Grid
  bm.add('grid-4col', {
    label: '4 Columns',
    category: 'Layout',
    content: `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 20px;">
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Col 1</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Col 2</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Col 3</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Col 4</p>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="4" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7.5" y="4" width="4" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="4" width="4" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="18.5" y="4" width="3.5" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  });
  
  // Flexbox Row
  bm.add('flex-row', {
    label: 'Flex Row',
    category: 'Layout',
    content: `
      <div style="display: flex; flex-direction: row; gap: 20px; padding: 20px; align-items: stretch;">
        <div style="flex: 1; padding: 20px; background: #e3f2fd; border: 2px dashed #2196f3; min-height: 100px;">
          <p>Flex Item 1</p>
        </div>
        <div style="flex: 1; padding: 20px; background: #e3f2fd; border: 2px dashed #2196f3; min-height: 100px;">
          <p>Flex Item 2</p>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="8" width="9" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="8" width="9" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Flexbox Column
  bm.add('flex-column', {
    label: 'Flex Column',
    category: 'Layout',
    content: `
      <div style="display: flex; flex-direction: column; gap: 20px; padding: 20px;">
        <div style="padding: 20px; background: #fff3e0; border: 2px dashed #ff9800; min-height: 80px;">
          <p>Flex Item 1</p>
        </div>
        <div style="padding: 20px; background: #fff3e0; border: 2px dashed #ff9800; min-height: 80px;">
          <p>Flex Item 2</p>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="4" y="2" width="16" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="16" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Hero Section
  bm.add('hero-section', {
    label: 'Hero Section',
    category: 'Layout',
    content: `
      <section style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 100px 20px; text-align: center;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <h1 style="font-size: 48px; margin-bottom: 20px; font-weight: bold;">Welcome to Our Website</h1>
          <p style="font-size: 20px; margin-bottom: 30px; opacity: 0.9;">Create amazing experiences with our powerful tools</p>
          <button style="background: white; color: #667eea; border: none; padding: 15px 40px; font-size: 16px; border-radius: 50px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">Get Started</button>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="9" x2="18" y2="9" stroke="currentColor" stroke-width="2"/><line x1="6" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="17" r="1.5" fill="currentColor"/></svg>',
  });
  
  // Card Layout
  bm.add('card', {
    label: 'Card',
    category: 'Layout',
    content: `
      <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; margin: 20px;">
        <h3 style="margin-top: 0; color: #333;">Card Title</h3>
        <p style="color: #666; line-height: 1.6;">This is a card component. Add your content here. Cards are great for organizing information.</p>
        <button style="background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 15px;">Learn More</button>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>',
  });
  
  // Split Section (50/50)
  bm.add('split-section', {
    label: 'Split Section',
    category: 'Layout',
    content: `
      <section style="display: grid; grid-template-columns: 1fr 1fr; min-height: 400px;">
        <div style="background: #f0f0f0; padding: 60px 40px; display: flex; flex-direction: column; justify-content: center;">
          <h2 style="margin-top: 0; color: #333;">Left Content</h2>
          <p style="color: #666; line-height: 1.8;">Add your text, images, or any content here. This split layout is perfect for showcasing features.</p>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 40px; display: flex; flex-direction: column; justify-content: center; color: white;">
          <h2 style="margin-top: 0;">Right Content</h2>
          <p style="opacity: 0.9; line-height: 1.8;">This side has a gradient background. Customize it to match your brand colors.</p>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="5" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="5" width="9" height="14" rx="1" fill="currentColor" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Header/Navbar
  bm.add('navbar', {
    label: 'Navigation Bar',
    category: 'Layout',
    content: `
      <nav style="background: linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; font-family: Arial, sans-serif;">
        <div style="font-size: 24px; font-weight: bold;">BESSER</div>
        <div style="display: flex; gap: 30px;">
          <a href="/" style="color: white; text-decoration: none;">Home</a>
          <a href="/about" style="color: white; text-decoration: none;">About</a>
        </div>
      </nav>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="4" rx="1" fill="currentColor"/><line x1="2" y1="11" x2="22" y2="11" stroke="currentColor" stroke-width="2"/><line x1="2" y1="15" x2="22" y2="15" stroke="currentColor" stroke-width="2"/><line x1="2" y1="19" x2="22" y2="19" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Footer
  bm.add('footer', {
    label: 'Footer',
    category: 'Layout',
    content: `
      <footer style="background: linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important; color: white; padding: 40px 20px; margin-top: 60px; font-family: Arial, sans-serif;">
        <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
          <div>
            <h4 style="margin-top: 0;">About BESSER</h4>
            <p style="opacity: 0.8; line-height: 1.6;">BESSER is a low-code platform for building smarter software faster. Empower your development with our dashboard generator and modeling tools.</p>
          </div>
          <div>
            <h4 style="margin-top: 0;">Quick Links</h4>
            <ul style="list-style: none; padding: 0; opacity: 0.8;">
              <li style="margin: 8px 0;"><a href="/about" style="color: white; text-decoration: none;">About</a></li>
            </ul>
          </div>
          <div>
            <h4 style="margin-top: 0;">Contact</h4>
            <p style="opacity: 0.8;">Email: info@besser-pearl.org<br>Phone: (123) 456-7890</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">
          © 2025 BESSER. All rights reserved.
        </div>
      </footer>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="16" width="20" height="6" rx="1" fill="currentColor"/><rect x="2" y="2" width="20" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // Divider
  bm.add('divider', {
    label: 'Divider',
    category: 'Layout',
    content: `
      <hr style="border: none; border-top: 2px solid #ddd; margin: 30px 0;">
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // // Pricing Table (3 tiers)
  // bm.add('pricing-table', {
  //   label: 'Pricing Table',
  //   category: 'Layout',
  //   content: `
  //     <section style="padding: 60px 20px; background: #f9f9f9;">
  //       <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
  //         <h2 style="font-size: 36px; margin-bottom: 50px; color: #333;">Choose Your Plan</h2>
  //         <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
  //           <!-- Basic Plan -->
  //           <div style="background: white; border-radius: 12px; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); transition: transform 0.3s;">
  //             <h3 style="color: #666; margin-top: 0; font-size: 20px;">Basic</h3>
  //             <div style="margin: 20px 0;">
  //               <span style="font-size: 48px; font-weight: bold; color: #333;">$9</span>
  //               <span style="color: #999;">/month</span>
  //             </div>
  //             <ul style="list-style: none; padding: 0; margin: 30px 0; text-align: left;">
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ 10 GB Storage</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ Basic Support</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ 1 User</li>
  //             </ul>
  //             <button style="width: 100%; padding: 12px; background: #e0e0e0; color: #333; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer;">Select Plan</button>
  //           </div>
  //           <!-- Pro Plan (Featured) -->
  //           <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 40px 30px; box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4); transform: scale(1.05); color: white;">
  //             <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px;">POPULAR</div>
  //             <h3 style="margin-top: 0; font-size: 20px;">Pro</h3>
  //             <div style="margin: 20px 0;">
  //               <span style="font-size: 48px; font-weight: bold;">$29</span>
  //               <span style="opacity: 0.8;">/month</span>
  //             </div>
  //             <ul style="list-style: none; padding: 0; margin: 30px 0; text-align: left;">
  //               <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">✓ 100 GB Storage</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">✓ Priority Support</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">✓ 10 Users</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">✓ Advanced Features</li>
  //             </ul>
  //             <button style="width: 100%; padding: 12px; background: white; color: #667eea; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer;">Select Plan</button>
  //           </div>
  //           <!-- Enterprise Plan -->
  //           <div style="background: white; border-radius: 12px; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  //             <h3 style="color: #666; margin-top: 0; font-size: 20px;">Enterprise</h3>
  //             <div style="margin: 20px 0;">
  //               <span style="font-size: 48px; font-weight: bold; color: #333;">$99</span>
  //               <span style="color: #999;">/month</span>
  //             </div>
  //             <ul style="list-style: none; padding: 0; margin: 30px 0; text-align: left;">
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ Unlimited Storage</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ 24/7 Support</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ Unlimited Users</li>
  //               <li style="padding: 10px 0; border-bottom: 1px solid #eee;">✓ Custom Integration</li>
  //             </ul>
  //             <button style="width: 100%; padding: 12px; background: #333; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer;">Select Plan</button>
  //           </div>
  //         </div>
  //       </div>
  //     </section>
  //   `,
  //   attributes: { class: 'fa fa-usd' }
  // });
  
  // Feature Grid (3 features)
  bm.add('feature-grid', {
    label: 'Feature Grid',
    category: 'Layout',
    content: `
      <section style="padding: 60px 20px;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <h2 style="text-align: center; font-size: 36px; margin-bottom: 50px; color: #333;">Our Features</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px;">
            <!-- Feature 1 -->
            <div style="text-align: center; padding: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; color: white;">🚀</div>
              <h3 style="color: #333; margin: 20px 0 15px;">Fast Performance</h3>
              <p style="color: #666; line-height: 1.6;">Lightning-fast loading times and smooth interactions for the best user experience.</p>
            </div>
            <!-- Feature 2 -->
            <div style="text-align: center; padding: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; color: white;">🔒</div>
              <h3 style="color: #333; margin: 20px 0 15px;">Secure & Safe</h3>
              <p style="color: #666; line-height: 1.6;">Enterprise-grade security to protect your data and ensure privacy.</p>
            </div>
            <!-- Feature 3 -->
            <div style="text-align: center; padding: 30px;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; color: white;">📱</div>
              <h3 style="color: #333; margin: 20px 0 15px;">Responsive Design</h3>
              <p style="color: #666; line-height: 1.6;">Works perfectly on all devices - desktop, tablet, and mobile.</p>
            </div>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  });
  
  // // Testimonial Section
  // bm.add('testimonial-section', {
  //   label: 'Testimonials',
  //   category: 'Layout',
  //   content: `
  //     <section style="padding: 80px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
  //       <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
  //         <h2 style="font-size: 36px; margin-bottom: 50px;">What Our Clients Say</h2>
  //         <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
  //           <!-- Testimonial 1 -->
  //           <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 12px; padding: 30px; text-align: left;">
  //             <div style="font-size: 40px; opacity: 0.3; margin-bottom: 10px;">"</div>
  //             <p style="font-size: 16px; line-height: 1.8; margin-bottom: 20px;">This product has completely transformed the way we work. Highly recommended!</p>
  //             <div style="display: flex; align-items: center; gap: 15px; margin-top: 20px;">
  //               <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>
  //               <div>
  //                 <div style="font-weight: bold;">John Doe</div>
  //                 <div style="opacity: 0.8; font-size: 14px;">CEO, Company Inc.</div>
  //               </div>
  //             </div>
  //           </div>
  //           <!-- Testimonial 2 -->
  //           <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 12px; padding: 30px; text-align: left;">
  //             <div style="font-size: 40px; opacity: 0.3; margin-bottom: 10px;">"</div>
  //             <p style="font-size: 16px; line-height: 1.8; margin-bottom: 20px;">Amazing service and incredible support. Best decision we've made this year!</p>
  //             <div style="display: flex; align-items: center; gap: 15px; margin-top: 20px;">
  //               <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>
  //               <div>
  //                 <div style="font-weight: bold;">Jane Smith</div>
  //                 <div style="opacity: 0.8; font-size: 14px;">Marketing Director</div>
  //               </div>
  //             </div>
  //           </div>
  //           <!-- Testimonial 3 -->
  //           <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 12px; padding: 30px; text-align: left;">
  //             <div style="font-size: 40px; opacity: 0.3; margin-bottom: 10px;">"</div>
  //             <p style="font-size: 16px; line-height: 1.8; margin-bottom: 20px;">Exceeded all our expectations. The team is professional and responsive.</p>
  //             <div style="display: flex; align-items: center; gap: 15px; margin-top: 20px;">
  //               <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>
  //               <div>
  //                 <div style="font-weight: bold;">Mike Johnson</div>
  //                 <div style="opacity: 0.8; font-size: 14px;">Product Manager</div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     </section>
  //   `,
  //   attributes: { class: 'fa fa-quote-left' }
  // });
  
  // CTA Banner
  bm.add('cta-banner', {
    label: 'CTA Banner',
    category: 'Layout',
    content: `
      <section style="background: linear-gradient(135deg, #4b3c82 0%, #5a3d91 100%) !important; padding: 80px 20px; text-align: center; color: white; font-family: Arial, sans-serif;">
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 42px; margin-bottom: 20px; font-weight: bold;">Build Smarter Dashboards Faster with BESSER</h2>
          <p style="font-size: 20px; margin-bottom: 40px; opacity: 0.95;">Create interactive dashboards effortlessly and streamline your workflow with BESSER's low-code platform.</p>
          <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
            <button style="background: white; color: #4b3c82; border: none; padding: 18px 40px; font-size: 18px; border-radius: 50px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.2s;">Try Dashboard</button>
            <button style="background: transparent; color: white; border: 2px solid white; padding: 18px 40px; font-size: 18px; border-radius: 50px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Explore Features</button>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/><path d="M8 12 L11 15 L16 10" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });
  
  // // Contact Form
  // bm.add('contact-form', {
  //   label: 'Contact Form',
  //   category: 'Layout',
  //   content: `
  //     <section style="padding: 60px 20px; background: #f5f5f5;">
  //       <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  //         <h2 style="text-align: center; color: #333; margin-bottom: 30px;">Get In Touch</h2>
  //         <form>
  //           <div style="margin-bottom: 20px;">
  //             <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Name</label>
  //             <input type="text" placeholder="Your name" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;">
  //           </div>
  //           <div style="margin-bottom: 20px;">
  //             <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Email</label>
  //             <input type="email" placeholder="your@email.com" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;">
  //           </div>
  //           <div style="margin-bottom: 20px;">
  //             <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">Message</label>
  //             <textarea placeholder="Your message..." rows="5" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; resize: vertical;"></textarea>
  //           </div>
  //           <button type="submit" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: transform 0.2s;">Send Message</button>
  //         </form>
  //       </div>
  //     </section>
  //   `,
  //   attributes: { class: 'fa fa-envelope' }
  // });
  
  // Stats/Counter Section
  bm.add('stats-section', {
    label: 'Stats Counter',
    category: 'Layout',
    content: `
      <section style="padding: 80px 20px; background: #2c3e50; color: white;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; text-align: center;">
            <!-- Stat 1 -->
            <div>
              <div style="font-size: 48px; font-weight: bold; color: #3498db; margin-bottom: 10px;">1000+</div>
              <div style="font-size: 18px; opacity: 0.9;">Happy Clients</div>
            </div>
            <!-- Stat 2 -->
            <div>
              <div style="font-size: 48px; font-weight: bold; color: #2ecc71; margin-bottom: 10px;">50+</div>
              <div style="font-size: 18px; opacity: 0.9;">Team Members</div>
            </div>
            <!-- Stat 3 -->
            <div>
              <div style="font-size: 48px; font-weight: bold; color: #e74c3c; margin-bottom: 10px;">99%</div>
              <div style="font-size: 18px; opacity: 0.9;">Satisfaction Rate</div>
            </div>
            <!-- Stat 4 -->
            <div>
              <div style="font-size: 48px; font-weight: bold; color: #f39c12; margin-bottom: 10px;">24/7</div>
              <div style="font-size: 18px; opacity: 0.9;">Support Available</div>
            </div>
          </div>
        </div>
      </section>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M2 20 L7 12 L12 16 L22 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="16" r="2" fill="currentColor"/><circle cx="22" cy="4" r="2" fill="currentColor"/></svg>',
  });

  // Analytics Dashboard Template
  bm.add('analytics-dashboard', {
    label: 'Analytics Dashboard',
    category: 'Templates',
    content: `
      <div class="dashboard-container" style="padding: 20px; background: linear-gradient(135deg, rgb(75, 60, 130) 0%, rgb(90, 61, 145) 100%);">
        <div style="max-width: 1400px; margin: 0 auto;">
          <!-- Dashboard Header -->
          <div style="margin-bottom: 30px;">
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px;">Analytics Dashboard</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 0;">Real-time insights and metrics</p>
          </div>
          
          <!-- KPI Cards Row -->
          <div class="kpi-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div data-gjs-type="metric-card"></div>
            <div data-gjs-type="metric-card"></div>
            <div data-gjs-type="metric-card"></div>
            <div data-gjs-type="metric-card"></div>
          </div>
          
          <!-- Charts Row -->
          <div class="charts-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 20px 0; color: #2c3e50;">Revenue Trend</h3>
              <div style="width: 100%; height: 300px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 8px; color: #666;">
                📊 Drop a Line Chart here
              </div>
            </div>
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 20px 0; color: #2c3e50;">Category Distribution</h3>
              <div style="width: 100%; height: 300px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 8px; color: #666;">
                🥧 Drop a Pie Chart here
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="3" width="20" height="5" rx="1" fill="currentColor" opacity="0.3"/><rect x="2" y="10" width="9" height="11" rx="1" fill="currentColor"/><rect x="13" y="10" width="9" height="11" rx="1" fill="currentColor"/></svg>',
  });

  // KPI Dashboard Template
  bm.add('kpi-dashboard', {
    label: 'KPI Dashboard',
    category: 'Templates',
    content: `
      <div class="kpi-dashboard" style="padding: 40px 20px; background: #f5f7fa;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <!-- Header -->
          <div style="margin-bottom: 40px; text-align: center;">
            <h1 style="color: #2c3e50; margin: 0 0 10px 0;">Key Performance Indicators</h1>
            <p style="color: #7f8c8d; margin: 0;">Track your most important metrics at a glance</p>
          </div>
          
          <!-- 3-Column KPI Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
            <div data-gjs-type="metric-card" data-gjs-metric-title="Total Revenue" data-gjs-format="currency" data-gjs-value-color="#3498db"></div>
            <div data-gjs-type="metric-card" data-gjs-metric-title="Active Users" data-gjs-format="number" data-gjs-value-color="#2ecc71"></div>
            <div data-gjs-type="metric-card" data-gjs-metric-title="System Uptime" data-gjs-format="percentage" data-gjs-value-color="#e74c3c"></div>
          </div>
        </div>
      </div>
    `,
    media: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="4" width="6" height="6" rx="1" fill="currentColor"/><rect x="3" y="13" width="6" height="6" rx="1" fill="currentColor"/><rect x="12" y="4" width="9" height="15" rx="1" fill="currentColor" opacity="0.5"/></svg>',
  });
}

