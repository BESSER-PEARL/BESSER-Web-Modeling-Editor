"""Capture documentation screenshots through the real editor UI.

Requires Playwright and Chromium. No responses or project storage are mocked.
The optional --assistant flag sends one request to the hosted modeling agent.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def dismiss_toasts(page):
    page.locator('.Toastify__close-button').evaluate_all(
        'buttons => buttons.forEach(button => button.click())'
    )


def settle_animations(page):
    # Visible controls can still be fading in after a locator becomes visible.
    # Wait for finite UI transitions, leaving recurring indicators untouched.
    page.evaluate("async () => { await Promise.allSettled(document.getAnimations()"
                  ".filter(animation => animation.playState === 'running' && "
                  "Number.isFinite(animation.effect.getComputedTiming().endTime))"
                  ".map(animation => animation.finished)); }")


def class_box(page, name):
    return page.locator('svg text').filter(has_text=name).first.evaluate(
        "node => { let group = node.parentElement; "
        "while (group && group.tagName.toLowerCase() !== 'g') group = group.parentElement; "
        "if (!group) throw new Error('Class SVG group not found'); "
        "const rect = group.getBoundingClientRect(); "
        "return {x:rect.x, y:rect.y, width:rect.width, height:rect.height}; }"
    )


def drag_class(page, x, y):
    page.mouse.move(270, 130)
    page.mouse.down()
    page.mouse.move(x, y, steps=20)
    page.mouse.up()
    page.mouse.dblclick(x, y)
    page.locator('input[maxlength]:not([placeholder])').wait_for()


def capture(page, output, filename, clip=None):
    dismiss_toasts(page)
    page.mouse.move(800, 700)
    settle_animations(page)
    page.screenshot(path=str(output / filename), clip=clip)
    print(f'Captured {filename}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--editor-url', default='https://experimental.besser-pearl.org/')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'build' / 'screenshots')
    parser.add_argument('--assistant', action='store_true', help='Send one real modeling request using the editor default hosted provider')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    evidence = {'captured_at': datetime.now(timezone.utc).isoformat(), 'editor_url': args.editor_url, 'viewport': {'width': 1440, 'height': 1000}, 'assistant_requested': args.assistant}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport=evidence['viewport'], locale='en-US', color_scheme='light')
        # Only this fresh automation context is affected; no existing profile is used.
        context.add_init_script("localStorage.setItem('besser_analytics_consent', JSON.stringify({status:'declined', timestamp:new Date().toISOString(), version:'1.2'}));")
        page = context.new_page()
        page.set_default_timeout(20000)
        try:
            page.goto(args.editor_url, wait_until='networkidle', timeout=90000)
            page.get_by_text('Start modelling', exact=True).wait_for()
            settle_animations(page)
            page.get_by_role('dialog').screenshot(path=str(output / 'interface-choice.png'))
            page.get_by_text('Start modelling', exact=True).click()
            page.locator('#project-name').fill('My Library')
            page.get_by_text('Data Modeler', exact=True).click()
            settle_animations(page)
            page.get_by_role('dialog').screenshot(path=str(output / 'new-project.png'))
            page.get_by_role('button', name='Create Project', exact=True).click()
            page.locator('#project-name').wait_for(state='hidden')
            dismiss_toasts(page)

            drag_class(page, 600, 300)
            page.locator('input[maxlength]:not([placeholder])').fill('Book')
            page.get_by_placeholder('attribute name', exact=True).fill('title')
            page.get_by_placeholder('+ attribute: str', exact=True).fill('+ pages: int')
            page.get_by_placeholder('+ attribute: str', exact=True).press('Enter')
            page.locator('input[maxlength]:not([placeholder])').click()
            capture(page, output, 'book-properties.png')

            page.mouse.click(800, 200)
            drag_class(page, 950, 450)
            page.locator('input[maxlength]:not([placeholder])').fill('Author')
            page.get_by_placeholder('attribute name', exact=True).fill('name')
            page.keyboard.press('Escape')

            book = class_box(page, 'Book')
            page.mouse.click(book['x'] + book['width'] / 2, book['y'] + 20)
            page.locator('svg[fill="#0064ff"]').first.wait_for()
            book, author = class_box(page, 'Book'), class_box(page, 'Author')
            source = (book['x'] + book['width'] + 7, book['y'] + book['height'] / 2)
            target = (author['x'] - 8, author['y'] + author['height'] / 2)
            page.mouse.move(*source)
            page.mouse.down()
            page.mouse.move(*target, steps=25)
            page.mouse.up()
            # The default connection has three orthogonal segments.
            midpoint = ((book['x'] + book['width'] + author['x']) / 2, (source[1] + target[1]) / 2)
            page.mouse.dblclick(*midpoint)
            page.get_by_placeholder('Association name', exact=True).fill('written_by')
            page.get_by_placeholder('1..1', exact=True).nth(0).fill('*')
            page.get_by_placeholder('1..1', exact=True).nth(1).fill('1')
            page.get_by_placeholder('Association name', exact=True).click()
            assert page.locator('input[type="checkbox"]:checked').count() == 2
            capture(page, output, 'book-author-association.png', {'x': 365, 'y': 145, 'width': 1075, 'height': 410})
            page.keyboard.press('Escape')

            page.get_by_title('Quality Check', exact=True).click()
            page.get_by_text('✅ Diagram is valid', exact=True).wait_for()
            evidence['manual_model_validation'] = 'Diagram is valid'
            dismiss_toasts(page)
            page.get_by_role('button', name='Generate', exact=True).click()
            page.get_by_role('menuitem', name='OOP', exact=True).hover()
            page.get_by_role('menuitem', name='Python Classes', exact=True).wait_for()
            # Keep the submenu open while capturing; moving the pointer closes it.
            settle_animations(page)
            page.screenshot(path=str(output / 'generate-python.png'), clip={'x': 450, 'y': 0, 'width': 800, 'height': 530})
            with page.expect_download(timeout=60000) as pending:
                page.get_by_role('menuitem', name='Python Classes', exact=True).click()
            pending.value.save_as(output / 'library-classes.py')
            source_code = (output / 'library-classes.py').read_text(encoding='utf-8')
            assert 'class Book' in source_code and 'class Author' in source_code
            compile(source_code, 'library-classes.py', 'exec')
            evidence['python_download'] = 'Both classes present; syntax valid'

            page.keyboard.press('Escape')
            page.get_by_role('button', name='File', exact=True).click()
            page.get_by_role('menuitem', name='Export Project', exact=True).click()
            dialog = page.get_by_role('dialog').filter(has_text='Export Project')
            dialog.wait_for()
            settle_animations(page)
            dialog.screenshot(path=str(output / 'export-project.png'))
            with page.expect_download(timeout=30000) as pending:
                page.get_by_role('button', name='Export as JSON', exact=True).click()
            pending.value.save_as(output / 'library-project.json')
            exported = json.loads((output / 'library-project.json').read_text(encoding='utf-8'))
            assert all(value in json.dumps(exported['project']) for value in ['Book', 'Author', 'written_by'])
            evidence['besser_version'] = exported.get('besserVersion')
            evidence['editor_version'] = exported.get('editorVersion')
            evidence['project_backup'] = 'Both classes and association present'
            dialog.wait_for(state='hidden')

            if args.assistant:
                page.get_by_role('button', name='Open assistant', exact=True).click()
                composer = page.locator('textarea:visible').last
                prompt = 'Add an integer attribute named publication_year to the existing Book class. Keep Author and the written_by association unchanged.'
                composer.fill(prompt)
                composer.press('Enter')
                page.wait_for_function("[...document.querySelectorAll('svg text')].some(n => n.textContent.includes('publication_year'))", timeout=60000)
                page.get_by_role('button', name='Review the model', exact=True).last.wait_for(timeout=60000)
                card = page.locator('textarea:visible').last.locator('xpath=ancestor::div[contains(@class,"rounded-2xl") and contains(@class,"overflow-hidden")][1]')
                settle_animations(page)
                card.screenshot(path=str(output / 'assistant-result.png'))
                evidence['assistant_prompt'] = prompt
                evidence['assistant_response'] = card.inner_text()
                page.get_by_role('button', name='Review the model', exact=True).last.click()
                page.get_by_title('Quality Check', exact=True).click()
                page.get_by_text('✅ Diagram is valid', exact=True).wait_for()
                evidence['assistant_model_validation'] = 'Diagram is valid'

            (output / 'capture-manifest.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
            print(f'Screenshots and verification evidence: {output}', flush=True)
        except Exception:
            page.screenshot(path=str(output / 'capture-error.png'))
            raise
        finally:
            context.close()
            browser.close()


if __name__ == '__main__':
    main()
