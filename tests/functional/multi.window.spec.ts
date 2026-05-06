import { test, expect, BrowserContext } from '@playwright/test';

test.describe('Multi Window/Tab Handling', () => {
  test('should handle multiple windows on the-internet.herokuapp.com', async ({ context, page }) => {
    // Navigate to the site
    await page.goto('https://the-internet.herokuapp.com/');
    
    // Verify the home page title
    const homeTitle = await page.title();
    expect(homeTitle).toContain('The Internet');
    console.log(`Home page title: ${homeTitle}`);
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Find and click on "Multiple Windows" link
    const multiWindowLink = page.locator('a', { hasText: 'Multiple Windows' });
    await multiWindowLink.waitFor({ state: 'visible', timeout: 5000 });
    
    // Navigate to the Multiple Windows demo page
    await multiWindowLink.click();
    await page.waitForLoadState('networkidle');
    
    // Now we're on the Multiple Windows page, verify the title
    const multiWindowPageTitle = await page.title();
    console.log(`Multiple Windows page title: ${multiWindowPageTitle}`);
    expect(multiWindowPageTitle).toBeTruthy();
    
    // Look for the "Click Here" link to open a new window
    const clickHereLink = page.locator('a[target="_blank"][href="/windows/new"]');
    await clickHereLink.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Found Click Here link');
    
    // Set up listener for new page BEFORE clicking
    let newPageOpened: any;
    const pagePromise = new Promise(resolve => {
      context.once('page', (newPage) => {
        newPageOpened = newPage;
        resolve(newPage);
      });
    });
    
    // Click to open new window
    await clickHereLink.click();
    
    // Wait for new page to open (with timeout)
    const newPage = await Promise.race([
      pagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('New page did not open')), 5000))
    ]) as any;
    
    // Wait for the new page to load
    await newPage.waitForLoadState('networkidle');
    const newPageTitle = await newPage.title();
    console.log(`New window title: ${newPageTitle}`);
    
    // Assert content in new page
    const newPageContent = await newPage.textContent('body');
    expect(newPageContent).toBeTruthy();
    console.log(`New window loaded successfully`);
    
    // Click another link in the new window to open yet another window
    const anotherLink = newPage.locator('a[target="_blank"]').first();
    if (await anotherLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      let secondNewPage: any;
      const secondPagePromise = new Promise(resolve => {
        context.once('page', (newPage) => {
          secondNewPage = newPage;
          resolve(newPage);
        });
      });
      
      await anotherLink.click();
      
      const secondPage = await Promise.race([
        secondPagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Second page did not open')), 5000))
      ]) as any;
      
      await secondPage.waitForLoadState('networkidle');
      const secondPageTitle = await secondPage.title();
      console.log(`Second new window title: ${secondPageTitle}`);
      
      // Assert content
      const secondPageContent = await secondPage.textContent('body');
      expect(secondPageContent).toBeTruthy();
      
      // Close the second new page
      await secondPage.close();
      console.log('Closed second new window');
    }
    
    // Close the first new page and return to parent
    await newPage.close();
    console.log('Closed first new window');
    
    // Verify we're back on the Multiple Windows page
    const finalTitle = await page.title();
    expect(finalTitle).toBeTruthy();
    console.log(`Back to parent window title: ${finalTitle}`);
    
    console.log('✅ Successfully handled multiple windows and returned to parent window');
  });
});


