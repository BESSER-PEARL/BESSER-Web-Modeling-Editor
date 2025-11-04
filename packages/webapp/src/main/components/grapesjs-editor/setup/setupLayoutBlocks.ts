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
    attributes: { class: 'fa fa-square-o' }
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
    attributes: { class: 'fa fa-bars' }
  });
  
  // 2 Column Grid
  bm.add('grid-2col', {
    label: '2 Columns',
    category: 'Layout',
    content: `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px;">
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Column 1</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Column 2</p>
        </div>
      </div>
    `,
    attributes: { class: 'fa fa-columns' }
  });
  
  // 3 Column Grid
  bm.add('grid-3col', {
    label: '3 Columns',
    category: 'Layout',
    content: `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; padding: 20px;">
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Column 1</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Column 2</p>
        </div>
        <div style="padding: 20px; background: #f0f0f0; border: 2px dashed #ccc; min-height: 100px;">
          <p>Column 3</p>
        </div>
      </div>
    `,
    attributes: { class: 'fa fa-th' }
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
    attributes: { class: 'fa fa-th-large' }
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
    attributes: { class: 'fa fa-arrows-h' }
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
    attributes: { class: 'fa fa-arrows-v' }
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
    attributes: { class: 'fa fa-header' }
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
    attributes: { class: 'fa fa-id-card-o' }
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
    attributes: { class: 'fa fa-pause' }
  });
  
  // Header/Navbar
  bm.add('navbar', {
    label: 'Navigation Bar',
    category: 'Layout',
    content: `
      <nav style="background: #333; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 24px; font-weight: bold;">Logo</div>
        <div style="display: flex; gap: 30px;">
          <a href="#" style="color: white; text-decoration: none;">Home</a>
          <a href="#" style="color: white; text-decoration: none;">About</a>
          <a href="#" style="color: white; text-decoration: none;">Services</a>
          <a href="#" style="color: white; text-decoration: none;">Contact</a>
        </div>
      </nav>
    `,
    attributes: { class: 'fa fa-navicon' }
  });
  
  // Footer
  bm.add('footer', {
    label: 'Footer',
    category: 'Layout',
    content: `
      <footer style="background: #2c3e50; color: white; padding: 40px 20px; margin-top: 60px;">
        <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
          <div>
            <h4 style="margin-top: 0;">About Us</h4>
            <p style="opacity: 0.8; line-height: 1.6;">Your company description goes here.</p>
          </div>
          <div>
            <h4 style="margin-top: 0;">Quick Links</h4>
            <ul style="list-style: none; padding: 0; opacity: 0.8;">
              <li style="margin: 8px 0;"><a href="#" style="color: white; text-decoration: none;">Home</a></li>
              <li style="margin: 8px 0;"><a href="#" style="color: white; text-decoration: none;">Services</a></li>
              <li style="margin: 8px 0;"><a href="#" style="color: white; text-decoration: none;">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 style="margin-top: 0;">Contact</h4>
            <p style="opacity: 0.8;">Email: info@example.com<br>Phone: (123) 456-7890</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">
          © 2025 Your Company. All rights reserved.
        </div>
      </footer>
    `,
    attributes: { class: 'fa fa-minus' }
  });
  
  // // Spacer
  // bm.add('spacer', {
  //   label: 'Spacer',
  //   category: 'Layout',
  //   content: `
  //     <div style="height: 50px; background: transparent;"></div>
  //   `,
  //   attributes: { class: 'fa fa-arrows-v' }
  // });
  
  // Divider
  bm.add('divider', {
    label: 'Divider',
    category: 'Layout',
    content: `
      <hr style="border: none; border-top: 2px solid #ddd; margin: 30px 0;">
    `,
    attributes: { class: 'fa fa-minus' }
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
    attributes: { class: 'fa fa-star' }
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
      <section style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 80px 20px; text-align: center; color: white;">
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 42px; margin-bottom: 20px; font-weight: bold;">Ready to Get Started?</h2>
          <p style="font-size: 20px; margin-bottom: 40px; opacity: 0.95;">Join thousands of satisfied customers and take your business to the next level.</p>
          <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
            <button style="background: white; color: #f5576c; border: none; padding: 18px 40px; font-size: 18px; border-radius: 50px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.2s;">Start Free Trial</button>
            <button style="background: transparent; color: white; border: 2px solid white; padding: 18px 40px; font-size: 18px; border-radius: 50px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Learn More</button>
          </div>
        </div>
      </section>
    `,
    attributes: { class: 'fa fa-bullhorn' }
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
    attributes: { class: 'fa fa-line-chart' }
  });
  
  // // Image Gallery
  // bm.add('image-gallery', {
  //   label: 'Image Gallery',
  //   category: 'Layout',
  //   content: `
  //     <section style="padding: 60px 20px;">
  //       <div style="max-width: 1200px; margin: 0 auto;">
  //         <h2 style="text-align: center; font-size: 36px; margin-bottom: 50px; color: #333;">Gallery</h2>
  //         <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
  //           <!-- Image 1 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">📷</div>
  //           <!-- Image 2 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">🖼️</div>
  //           <!-- Image 3 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">🎨</div>
  //           <!-- Image 4 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">🌄</div>
  //           <!-- Image 5 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">🎭</div>
  //           <!-- Image 6 -->
  //           <div style="aspect-ratio: 1; background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; cursor: pointer; transition: transform 0.3s;">✨</div>
  //         </div>
  //       </div>
  //     </section>
  //   `,
  //   attributes: { class: 'fa fa-picture-o' }
  // });
  
  // Newsletter Signup
  // bm.add('newsletter-signup', {
  //   label: 'Newsletter',
  //   category: 'Layout',
  //   content: `
  //     <section style="padding: 60px 20px; background: #ecf0f1;">
  //       <div style="max-width: 600px; margin: 0 auto; text-align: center;">
  //         <h2 style="font-size: 32px; color: #333; margin-bottom: 15px;">📧 Subscribe to Our Newsletter</h2>
  //         <p style="color: #666; font-size: 16px; margin-bottom: 30px;">Get the latest updates and exclusive offers delivered to your inbox.</p>
  //         <form style="display: flex; gap: 10px; max-width: 500px; margin: 0 auto; flex-wrap: wrap;">
  //           <input type="email" placeholder="Enter your email" style="flex: 1; min-width: 250px; padding: 15px 20px; border: 2px solid #ddd; border-radius: 50px; font-size: 16px; outline: none;">
  //           <button type="submit" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px 35px; border-radius: 50px; font-size: 16px; font-weight: bold; cursor: pointer; white-space: nowrap;">Subscribe</button>
  //         </form>
  //         <p style="color: #999; font-size: 12px; margin-top: 15px;">We respect your privacy. Unsubscribe at any time.</p>
  //       </div>
  //     </section>
  //   `,
  //   attributes: { class: 'fa fa-paper-plane' }
  // });
}
