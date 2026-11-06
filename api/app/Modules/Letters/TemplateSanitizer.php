<?php

namespace App\Modules\Letters;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

/**
 * Cleans an uploaded-and-edited letter template (HTML) before it is stored (FR-T1, upload flow).
 * The browser converts the Word file, so its HTML is never trusted: a strict allowlist keeps only document
 * formatting, images may only be embedded PNG/JPEG data, styles may only align text or size images/cells,
 * and the only special markers are field chips (data-field) and the signature block (data-signature).
 * Everything else (scripts, event handlers, links, remote images, iframes, forms) is dropped.
 */
class TemplateSanitizer
{
    public const MAX_BYTES = 3_000_000;   // logos are embedded as data URIs; stays under the 4.5 MB request limit

    public const MAX_IMAGE_BYTES = 1_500_000;

    private const TEXT = ['p', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'hr', 'ul', 'ol', 'li', 'blockquote', 'sup', 'sub'];

    private const TABLE = ['table', 'thead', 'tbody', 'tr', 'th', 'td'];

    public static function clean(string $html): string
    {
        if (strlen($html) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['body' => 'The template is too large. Use smaller images (under about 1 MB each).']);
        }

        $config = (new HtmlSanitizerConfig)
            ->allowMediaSchemes(['data'])
            ->allowRelativeMedias(false)
            ->withMaxInputLength(self::MAX_BYTES);
        foreach (self::TEXT as $el) {
            $config = $config->allowElement($el, ['style']);
        }
        foreach (self::TABLE as $el) {
            $config = $config->allowElement($el, ['style', 'colspan', 'rowspan']);
        }
        $config = $config
            ->allowElement('img', ['src', 'alt', 'width', 'height', 'style'])
            ->allowElement('span', ['data-field', 'data-signature', 'style'])
            ->dropElement('script')->dropElement('style')->dropElement('iframe')->dropElement('object')->dropElement('embed');

        $clean = (new HtmlSanitizer($config))->sanitize($html);

        return self::tighten($clean);
    }

    /** Second pass: only safe CSS declarations, only embedded PNG/JPEG images, only known field keys. */
    private static function tighten(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $doc = new DOMDocument;
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8"?><div id="__root">'.$html.'</div>', LIBXML_NONET | LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $xp = new DOMXPath($doc);

        foreach (iterator_to_array($xp->query('//*[@style]')) as $el) {
            /** @var DOMElement $el */
            $kept = [];
            foreach (explode(';', $el->getAttribute('style')) as $decl) {
                [$prop, $val] = array_map('trim', explode(':', $decl, 2) + [1 => '']);
                $prop = strtolower($prop);
                if ($prop === 'text-align' && preg_match('/^(left|right|center|justify)$/i', $val)) {
                    $kept[] = "text-align: {$val}";
                } elseif (in_array($prop, ['width', 'height'], true) && preg_match('/^\d{1,4}(\.\d+)?(px|%)$/', $val)) {
                    $kept[] = "{$prop}: {$val}";
                }
            }
            $kept ? $el->setAttribute('style', implode('; ', $kept)) : $el->removeAttribute('style');
        }

        foreach (iterator_to_array($xp->query('//img')) as $img) {
            /** @var DOMElement $img */
            $src = $img->getAttribute('src');
            $ok = preg_match('#^data:image/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$#', $src, $m) && (strlen($m[2]) * 3 / 4) <= self::MAX_IMAGE_BYTES;
            if (! $ok) {
                $img->parentNode?->removeChild($img);
            }
        }

        foreach (iterator_to_array($xp->query('//span[@data-field]')) as $span) {
            /** @var DOMElement $span */
            $key = $span->getAttribute('data-field');
            if (! array_key_exists($key, LetterRenderer::PLACEHOLDERS)) {
                throw ValidationException::withMessages(['body' => "Unknown field: {$key}."]);
            }
            // A field is a marker: its visible text is regenerated so nothing else can hide inside it.
            while ($span->firstChild) {
                $span->removeChild($span->firstChild);
            }
            $span->appendChild($doc->createTextNode(LetterRenderer::PLACEHOLDERS[$key]));
        }
        foreach (iterator_to_array($xp->query('//span[@data-signature]')) as $span) {
            /** @var DOMElement $span */
            while ($span->firstChild) {
                $span->removeChild($span->firstChild);
            }
            $span->setAttribute('data-signature', '');
            $span->appendChild($doc->createTextNode('Signature'));
        }

        $root = $doc->getElementById('__root');
        $out = '';
        foreach ($root?->childNodes ?? [] as $child) {
            $out .= $doc->saveHTML($child);
        }

        return $out;
    }
}
